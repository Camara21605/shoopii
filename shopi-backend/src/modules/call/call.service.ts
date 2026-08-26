/* ============================================================
 * FICHIER : src/modules/call/call.service.ts
 *
 * RÔLE : Logique métier des appels audio/vidéo — permission,
 *        anti-spam, persistance (Call = actif, CallHistory =
 *        archive), notifications.
 *
 * RÉUTILISE (ne duplique pas) :
 *   - MessagingPermissionEngine : mêmes règles Cas 1/2/3 que la
 *     messagerie (contact téléphonique, follow, commande partagée).
 *   - PresenceService : présence en ligne/hors ligne (Redis, même
 *     namespace socket /messaging que les appels).
 *   - NotificationService : création + diffusion des notifications.
 * ============================================================ */

import {
  ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { randomUUID, createHmac } from 'crypto';

import { Call, CallStatus, CallType } from 'src/database/entities/call/call.entity';
import { CallHistory, CallHistoryStatus } from 'src/database/entities/call/call-history.entity';
import { User, UserStatus } from 'src/database/entities/user.entity';
import { Client }        from 'src/database/entities/profiles/client-profile.entity';
import { Company }       from 'src/database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from 'src/database/entities/profiles/livreur-profile.entity';
import { Correspondent } from 'src/database/entities/profiles/correspondant-profile.entity';
import { Partner }       from 'src/database/entities/profiles/partenaire-profile.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { ConversationActorType } from 'src/database/entities/messaging/conversation.entity';

import { MessagingPermissionEngine } from '../messagerie/permissions/messaging-permission.engine';
import type { PermissionContext }    from '../messagerie/permissions/interfaces/permission-context.interface';
import { PresenceService }           from '../messagerie/services/presence.service';
import { NotificationService }       from '../notifications/services/notification.service';
import {
  NotificationActorType, NotificationType, NotificationPriority,
} from 'src/database/entities/notification/notification.entitiy';

import type { StartCallDto } from './dto/call.dto';

/** Nombre max de tentatives d'appel par utilisateur / fenêtre de 60s. */
const RATE_LIMIT_MAX    = 10;
const RATE_LIMIT_TTL_S  = 60;

/** Code erreur Postgres "unique_violation" — TypeORM le recopie tel quel
 *  sur QueryFailedError (driver pg). Backstop de dernier ressort si le
 *  verrou consultatif (lockUsersForCall) a été contourné d'une façon ou
 *  d'une autre — voir la migration UNIQ_calls_active_pair. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

/** Forme attendue par RTCPeerConnection côté frontend (pas de lib DOM ici). */
export interface IceServerConfig {
  urls:        string | string[];
  username?:   string;
  credential?: string;
}

export type StartCallOutcome =
  | { outcome: 'ringing'; call: Call }
  | { outcome: 'busy' }
  | { outcome: 'offline' };

interface ResolvedActor {
  type: ConversationActorType;
  id:   string;
}

@Injectable()
export class CallService {
  private readonly logger = new Logger(CallService.name);

  constructor(
    @InjectRepository(Call)        private readonly callRepo:    Repository<Call>,
    @InjectRepository(CallHistory) private readonly historyRepo: Repository<CallHistory>,
    @InjectRepository(User)        private readonly userRepo:    Repository<User>,
    @InjectRepository(Client)        private readonly clientRepo: Repository<Client>,
    @InjectRepository(Company)       private readonly companyRepo: Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corrRepo: Repository<Correspondent>,
    @InjectRepository(Partner)       private readonly partnerRepo: Repository<Partner>,

    private readonly permissionEngine: MessagingPermissionEngine,
    private readonly presence:         PresenceService,
    private readonly notifications:    NotificationService,
    private readonly config:           ConfigService,
    private readonly dataSource:       DataSource,

    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ── Serveurs ICE (STUN + TURN Metered.ca) ─────────────────────

  private static readonly STATIC_STUN: IceServerConfig[] = [
    { urls: 'stun:stun.l.google.com:19302'  },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /** Durée de vie d'un identifiant TURN dynamique — largement au-dessus de
   *  la durée de négociation ICE (quelques secondes), mais courte pour
   *  limiter la fenêtre d'exploitation si jamais interceptée. */
  private static readonly TURN_CREDENTIAL_TTL_S = 3600;

  /**
   * Serveurs ICE (STUN + TURN Metered.ca). Restent côté serveur, jamais
   * exposés au bundle frontend — seul le payload de CETTE réponse (via
   * GET /calls/ice-servers) atteint le client, comme l'exige WebRTC.
   *
   * Deux modes, selon la configuration :
   *   1. METERED_TURN_SECRET défini → identifiants dynamiques à durée de
   *      vie limitée (1h), générés via le schéma HMAC-SHA1 standard "REST
   *      API TURN" (coturn et compatibles, dont Metered.ca) :
   *        username   = "<expiration_unix>:shopi"
   *        credential = base64(HMAC-SHA1(secret, username))
   *      Aucune valeur volée dans le trafic réseau ne reste utilisable
   *      au-delà d'une heure.
   *   2. Sinon → identifiants statiques (comportement historique, appels
   *      fonctionnels mais un identifiant intercepté reste valide
   *      indéfiniment tant qu'il n'est pas manuellement changé côté
   *      dashboard Metered).
   *
   * Fallback STUN seul si rien n'est configuré — les appels pourront
   * échouer derrière un NAT mobile strict, mais ne seront jamais bloqués.
   */
  /**
   * true une fois qu'on a déjà journalisé l'avertissement "mode statique"
   * pour ce process — évite de spammer les logs à chaque appel (potentiel-
   * lement des dizaines par minute) tout en gardant le risque visible au
   * démarrage/dans les premières minutes d'activité.
   */
  private staticModeWarned = false;

  /**
   * MULTI-FOURNISSEURS (partie 6) : un seul fournisseur TURN (Metered.ca)
   * est configuré aujourd'hui — STATIC_STUN + ce bloc suffisent. Un second
   * fournisseur s'ajouterait de la même façon : lire ses variables d'env
   * dédiées (ex. TURN2_HOST/TURN2_SECRET), générer son propre bloc
   * d'IceServerConfig avec le même schéma HMAC si le fournisseur le
   * supporte, puis le concaténer au tableau retourné. Ne PAS ajouter un
   * bloc "fournisseur secondaire" tant qu'aucun n'est réellement configuré
   * — un bloc STUN/TURN silencieusement non fonctionnel serait pire qu'une
   * absence (échec ICE difficile à diagnostiquer).
   */
  async getIceServers(): Promise<IceServerConfig[]> {
    const host   = this.config.get<string>('METERED_TURN_HOST');
    const secret = this.config.get<string>('METERED_TURN_SECRET');

    if (!host) {
      this.logger.warn('[ICE] METERED_TURN_HOST manquant — appels en STUN seul (échoueront souvent derrière un NAT mobile)');
      return CallService.STATIC_STUN;
    }

    let username: string;
    let credential: string;
    let mode: 'ephemeral' | 'static';

    if (secret) {
      const expiresAt = Math.floor(Date.now() / 1000) + CallService.TURN_CREDENTIAL_TTL_S;
      username   = `${expiresAt}:shopi`;
      credential = createHmac('sha1', secret).update(username).digest('base64');
      mode = 'ephemeral';
    } else {
      const staticUsername   = this.config.get<string>('METERED_TURN_USERNAME');
      const staticCredential = this.config.get<string>('METERED_TURN_CREDENTIAL');
      if (!staticUsername || !staticCredential) {
        this.logger.warn('[ICE] Ni METERED_TURN_SECRET ni METERED_TURN_USERNAME/CREDENTIAL configurés — appels en STUN seul');
        return CallService.STATIC_STUN;
      }
      username   = staticUsername;
      credential = staticCredential;
      mode = 'static';

      if (!this.staticModeWarned) {
        this.staticModeWarned = true;
        this.logger.warn(
          '[ICE] Identifiants TURN STATIQUES (non-expirants) — un identifiant intercepté reste ' +
          'utilisable indéfiniment. Définir METERED_TURN_SECRET (identifiants éphémères à durée de ' +
          `vie limitée, ${CallService.TURN_CREDENTIAL_TTL_S}s) dès que la clé secrète du compte Metered.ca est disponible.`,
        );
      }
    }

    /* Observabilité (partie 6) : aucune valeur sensible journalisée — ni le
       secret HMAC, ni le username/credential générés (le username porte un
       timestamp d'expiration en clair, jamais logué non plus par prudence). */
    this.logger.debug(`[ICE] serveurs fournis — mode=${mode}`);

    /* Pas de "stun:${host}" ici — le sous-domaine STUN de Metered
       (stun.relay.metered.ca) est différent du host TURN
       (global.relay.metered.ca) : les 2 entrées Google STATIC_STUN
       ci-dessus suffisent, pas besoin de deviner le bon sous-domaine. */
    return [
      ...CallService.STATIC_STUN,
      { urls: `turn:${host}:80`,               username, credential },
      { urls: `turn:${host}:80?transport=tcp`, username, credential },
      { urls: `turn:${host}:443`,              username, credential },
      { urls: `turns:${host}:443?transport=tcp`, username, credential },
    ];
  }

  // ── Résolution acteur (users.id → type + profil UUID) ────────

  private roleToActorType(role: UserRole): ConversationActorType | null {
    const map: Partial<Record<UserRole, ConversationActorType>> = {
      [UserRole.CLIENT]:        ConversationActorType.CLIENT,
      [UserRole.COMPANY]:       ConversationActorType.COMPANY,
      [UserRole.DELIVERY]:      ConversationActorType.DELIVERY,
      [UserRole.CORRESPONDENT]: ConversationActorType.CORRESPONDENT,
      [UserRole.PARTNER]:       ConversationActorType.PARTNER,
    };
    return map[role] ?? null;
  }

  /**
   * @param actorId Fallback pour un membre d'équipe (collaborateur) d'une
   * entreprise : son companies.userId ne pointe jamais vers lui (il pointe
   * vers le propriétaire), donc `companyRepo.findOne({ where: { userId } })`
   * échoue toujours pour son propre compte. Sans ce fallback, AUCUN
   * collaborateur ne peut jamais passer ni recevoir d'appel (assertCanCall
   * levait "Profil introuvable pour cet appel." à chaque tentative) — même
   * correctif que MessagerieService.resolveProfileId().
   */
  private async resolveActor(userId: string, role: UserRole, actorId?: string): Promise<ResolvedActor | null> {
    const type = this.roleToActorType(role);
    if (!type) return null;

    let profile: { id: string } | null = null;
    switch (type) {
      case ConversationActorType.CLIENT:
        profile = await this.clientRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.COMPANY:
        profile = await this.companyRepo.findOne({ where: { userId }, select: ['id'] });
        if (!profile && actorId) profile = await this.companyRepo.findOne({ where: { id: actorId }, select: ['id'] });
        break;
      case ConversationActorType.DELIVERY:
        profile = await this.deliveryRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.CORRESPONDENT:
        profile = await this.corrRepo.findOne({ where: { userId }, select: ['id'] }); break;
      case ConversationActorType.PARTNER:
        profile = await this.partnerRepo.findOne({ where: { userId }, select: ['id'] }); break;
    }
    return profile ? { type, id: profile.id } : null;
  }

  /** Résout (type acteur NotificationActorType, profil UUID) pour le destinataire d'une notification d'appel. */
  private async resolveNotificationRecipient(userId: string): Promise<{ type: NotificationActorType; id: string } | null> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role'] });
    if (!user) return null;
    const actor = await this.resolveActor(userId, user.role);
    if (!actor) return null;
    return { type: actor.type as unknown as NotificationActorType, id: actor.id };
  }

  // ── Vérification de permission (réutilise les règles de messagerie) ──

  async assertCanCall(callerUserId: string, calleeUserId: string, callerActorId?: string): Promise<void> {
    /* Garde explicite : userRepo.findOne({ where: { id: undefined } }) ne
       rejette pas — TypeORM ignore une clause where à undefined et renvoie
       une ligne arbitraire de la table. Sans ce garde, un socket dont
       l'authentification n'a pas fini de s'appliquer (socket.data.userId
       pas encore posé par MessagerieGateway.handleConnection, async) ferait
       passer l'appel pour un utilisateur totalement différent. */
    if (!callerUserId || !calleeUserId) {
      throw new ForbiddenException('Identifiant utilisateur manquant.');
    }
    if (callerUserId === calleeUserId) {
      throw new ForbiddenException('Vous ne pouvez pas vous appeler vous-même.');
    }

    const [caller, callee] = await Promise.all([
      this.userRepo.findOne({ where: { id: callerUserId } }),
      this.userRepo.findOne({ where: { id: calleeUserId } }),
    ]);

    if (!caller || caller.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Votre compte doit être actif pour passer un appel.');
    }
    if (!callee || callee.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Cet utilisateur est introuvable ou son compte est inactif.');
    }
    /* Pas de contrôle phoneVerified ici : aucun flux de vérification SMS
       ne met jamais ce champ à true dans l'app (0 utilisateur actif sur la
       base ne l'a) — la vérification bloquait donc TOUS les appels 1:1,
       sans exception, pour tout le monde. Les appels de groupe (group-call.
       gateway.ts) n'ont jamais eu ce contrôle — on aligne le comportement. */

    const [callerActor, calleeActor] = await Promise.all([
      this.resolveActor(callerUserId, caller.role, callerActorId),
      this.resolveActor(calleeUserId, callee.role),
    ]);
    if (!callerActor || !calleeActor) {
      throw new ForbiddenException('Profil introuvable pour cet appel.');
    }

    const ctx: PermissionContext = {
      requestorType:   callerActor.type,
      requestorId:     callerActor.id,
      requestorUserId: callerUserId,
      targetType:      calleeActor.type,
      targetId:        calleeActor.id,
      targetUserId:    calleeUserId,
      requestedAt:     new Date(),
    };

    const result = await this.permissionEngine.check(ctx);
    if (!result.granted) {
      throw new ForbiddenException(
        `Vous ne pouvez pas encore appeler cet utilisateur (${result.reason})`,
      );
    }
  }

  // ── Occupé / anti-spam ────────────────────────────────────────

  /** Un appel qui sonne/se connecte depuis plus longtemps que ça sans
   * jamais avoir été décroché est considéré abandonné (filet de sécurité
   * en plus du nettoyage à la déconnexion — voir endAllCallsForUser). */
  private static readonly STALE_UNANSWERED_MS = 60_000;

  async isUserBusy(userId: string, manager?: EntityManager): Promise<boolean> {
    const repo = manager ? manager.getRepository(Call) : this.callRepo;
    const calls = await repo.find({
      where: [{ callerId: userId }, { calleeId: userId }],
    });
    if (calls.length === 0) return false;

    let stillBusy = false;
    for (const call of calls) {
      const isStale =
        call.status !== CallStatus.CONNECTED &&
        Date.now() - call.startedAt.getTime() > CallService.STALE_UNANSWERED_MS;
      if (isStale) {
        await this.finalizeCall(call, CallHistoryStatus.MISSED, manager);
      } else {
        stillBusy = true;
      }
    }
    return stillBusy;
  }

  /**
   * PARTIE 9.5 — variante combinée de isUserBusy() pour startCall() UNIQUEMENT :
   * une seule requête DB pour caller+callee au lieu de deux appels isUserBusy()
   * séparés. Mesuré en conditions réelles : dans la transaction de startCall(),
   * `manager` est LA connexion unique de la transaction — deux requêtes
   * envoyées via Promise.all() dessus ne partent donc PAS réellement en
   * parallèle sur le réseau (elles se sérialisent sur cette même connexion
   * malgré l'apparence de parallélisme du code), contrairement aux lectures
   * hors transaction (assertCanCall) qui utilisent le pool et parallélisent
   * réellement. Même logique de nettoyage des appels abandonnés (stale)
   * qu'isUserBusy() — celle-ci n'est pas dupliquée, seulement réunie en un
   * aller-retour réseau au lieu de deux. isUserBusy() reste inchangée (utilisée
   * telle quelle par GET /calls/busy/:userId, hors de toute transaction).
   */
  private async checkBusyPair(
    callerUserId: string, calleeUserId: string, manager: EntityManager,
  ): Promise<{ callerBusy: boolean; calleeBusy: boolean }> {
    const repo = manager.getRepository(Call);
    const calls = await repo.find({
      where: [
        { callerId: callerUserId }, { calleeId: callerUserId },
        { callerId: calleeUserId }, { calleeId: calleeUserId },
      ],
    });

    let callerBusy = false;
    let calleeBusy = false;
    for (const call of calls) {
      const isStale =
        call.status !== CallStatus.CONNECTED &&
        Date.now() - call.startedAt.getTime() > CallService.STALE_UNANSWERED_MS;
      if (isStale) {
        await this.finalizeCall(call, CallHistoryStatus.MISSED, manager);
        continue;
      }
      if (call.callerId === callerUserId || call.calleeId === callerUserId) callerBusy = true;
      if (call.callerId === calleeUserId || call.calleeId === calleeUserId) calleeBusy = true;
    }
    return { callerBusy, calleeBusy };
  }

  /** Trouve l'appel actif entre deux utilisateurs (peu importe qui a appelé qui). */
  async findActiveCallId(userA: string, userB: string): Promise<string | null> {
    const call = await this.callRepo.findOne({
      where: [
        { callerId: userA, calleeId: userB },
        { callerId: userB, calleeId: userA },
      ],
    });
    return call?.id ?? null;
  }

  private async checkRateLimit(userId: string): Promise<void> {
    const key = `call:rate:${userId}`;
    let count: number;
    try {
      count = await this.redis.incr(key);
      if (count === 1) await this.redis.expire(key, RATE_LIMIT_TTL_S);
    } catch (e) {
      /* Une panne Redis ne doit jamais bloquer silencieusement tous les
         appels — même principe que presence.isOnlineOrUnknown() : on ne
         sait pas combien de tentatives ont eu lieu, donc on n'en bloque
         aucune plutôt que de casser toute la plateforme d'appel sur un
         Redis indisponible. */
      this.logger.warn(`[Call] Redis indisponible pour le rate-limit d'appel de ${userId} — autorisé par défaut : ${(e as Error).message}`);
      return;
    }
    if (count > RATE_LIMIT_MAX) {
      throw new ForbiddenException('Trop de tentatives d\'appel. Réessayez dans une minute.');
    }
  }

  /**
   * Verrous consultatifs Postgres (pg_advisory_xact_lock), acquis dans un
   * ordre déterministe (tri lexicographique des deux userId) pour qu'aucune
   * paire de transactions ne puisse se verrouiller mutuellement en tenant
   * l'un des deux verrous en ordre inverse. Portée : la transaction
   * courante — libérés automatiquement au commit/rollback.
   *
   * Sans ça, deux `startCall` concurrents impliquant un utilisateur commun
   * (A→B et C→A lancés à la même milliseconde, ou même A→B lancé deux fois
   * depuis deux onglets) peuvent TOUS LES DEUX lire "pas occupé" avant que
   * l'un des deux ait eu le temps d'insérer sa ligne `calls` — ce verrou
   * sérialise le "check occupé + insertion" en une section critique unique
   * par utilisateur impliqué.
   */
  private async lockUsersForCall(manager: EntityManager, userA: string, userB: string): Promise<void> {
    for (const userId of [userA, userB].sort()) {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
    }
  }

  // ── Cycle de vie de l'appel ───────────────────────────────────

  async startCall(callerUserId: string, dto: StartCallDto, callerActorId?: string): Promise<StartCallOutcome> {
    /* PARTIE 9.5 — timestamps de diagnostic (perf only, jamais de secret/
       SDP/JWT/donnée personnelle). logger.verbose() est déjà filtré hors
       des logs en production par la config Logger de main.ts
       (['error','warn','log'] uniquement quand NODE_ENV=production) —
       aucun flag supplémentaire nécessaire pour les désactiver. */
    const t0 = performance.now();
    await this.checkRateLimit(callerUserId);
    const t1 = performance.now();
    await this.assertCanCall(callerUserId, dto.calleeUserId, callerActorId);
    const t2 = performance.now();

    const result = await this.dataSource.transaction(async (manager) => {
      const tx0 = performance.now();
      await this.lockUsersForCall(manager, callerUserId, dto.calleeUserId);
      const tx1 = performance.now();

      /* PARTIE 9.5 — mesuré en conditions réelles : dans une transaction,
         `manager` est UNE connexion unique, donc les deux isUserBusy() ci-
         dessous (avant cette partie) se sérialisaient déjà malgré l'appel
         Promise.all — checkBusyPair() les réunit en une seule requête. La
         présence, elle, utilise Redis (connexion différente) et part donc
         réellement en parallèle. */
      const [{ callerBusy, calleeBusy }, online] = await Promise.all([
        this.checkBusyPair(callerUserId, dto.calleeUserId, manager),
        /* isOnlineOrUnknown (pas isOnline) : une panne Redis ne doit jamais
           bloquer silencieusement tous les appels 1:1 — voir presence.service.ts. */
        this.presence.isOnlineOrUnknown(dto.calleeUserId),
      ]);
      const tx2 = performance.now();

      if (callerBusy) {
        throw new ForbiddenException('Vous êtes déjà en appel.');
      }

      if (calleeBusy) {
        await this.recordShortCircuit(callerUserId, dto, CallHistoryStatus.BUSY, manager);
        await this.notifyCaller(callerUserId, dto.calleeUserId, NotificationType.CALL_BUSY,
          'Utilisateur occupé', 'La personne que vous appelez est déjà en appel.');
        return { outcome: 'busy' as const };
      }

      if (!online) {
        await this.recordShortCircuit(callerUserId, dto, CallHistoryStatus.MISSED, manager);
        await this.notifyCaller(callerUserId, dto.calleeUserId, NotificationType.CALL_OFFLINE,
          'Utilisateur hors ligne', 'La personne que vous appelez est actuellement hors ligne.');
        await this.notifyCallee(dto.calleeUserId, callerUserId, NotificationType.CALL_MISSED,
          'Appel manqué', 'Vous avez manqué un appel.');
        return { outcome: 'offline' as const };
      }

      const call = manager.create(Call, {
        callerId:       callerUserId,
        calleeId:       dto.calleeUserId,
        conversationId: dto.conversationId ?? null,
        callType:       dto.callType,
        status:         CallStatus.RINGING,
        startedAt:      new Date(),
      });

      try {
        const saved = await manager.save(call);
        const tx3 = performance.now();
        this.logger.verbose(
          `[Perf][startCall][tx] lock=${(tx1 - tx0).toFixed(1)}ms busy/presence=${(tx2 - tx1).toFixed(1)}ms insert=${(tx3 - tx2).toFixed(1)}ms txTotal=${(tx3 - tx0).toFixed(1)}ms`,
        );
        return { outcome: 'ringing' as const, call: saved };
      } catch (err) {
        /* Ne devrait normalement jamais arriver — lockUsersForCall() rend
           déjà cette section critique atomique — mais l'index unique
           UNIQ_calls_active_pair (migration 1721400000003) reste le
           dernier rempart si ce verrou était un jour contourné. */
        if (isUniqueViolation(err)) {
          throw new ConflictException('Un appel est déjà en cours avec cette personne.');
        }
        throw err;
      }
    });
    const t3 = performance.now();

    this.logger.verbose(
      `[Perf][startCall] rateLimit=${(t1 - t0).toFixed(1)}ms assertCanCall=${(t2 - t1).toFixed(1)}ms transaction=${(t3 - t2).toFixed(1)}ms total=${(t3 - t0).toFixed(1)}ms outcome=${result.outcome}`,
    );
    return result;
  }

  /**
   * @returns `alreadyAccepted: true` quand CET appel avait déjà été accepté
   * par un autre appareil du même callee AVANT que cette transaction n'ait
   * pu poser son verrou — permet à CallGateway de distinguer l'appareil
   * gagnant (qui doit notifier l'appelant) des appareils perdants (qui
   * doivent seulement être informés qu'ils ont perdu la course, sans
   * jamais re-notifier l'appelant une 2e fois).
   */
  async acceptCall(userId: string, callId: string): Promise<{ call: Call; alreadyAccepted: boolean }> {
    return this.dataSource.transaction(async (manager) => {
      /* pessimistic_write = SELECT ... FOR UPDATE — bloque toute autre
         transaction qui tenterait de lire/modifier CETTE ligne (accept
         depuis un 2e appareil, reject/end concurrent) jusqu'au commit. */
      const call = await manager.findOne(Call, { where: { id: callId }, lock: { mode: 'pessimistic_write' } });
      if (!call) throw new NotFoundException('Appel introuvable ou déjà terminé.');
      if (call.calleeId !== userId) {
        throw new ForbiddenException('Cet appel ne vous est pas destiné.');
      }
      /* Idempotent : si un autre appareil du même callee a déjà accepté
         pendant qu'on attendait le verrou, ne pas réémettre answeredAt. */
      if (call.status === CallStatus.CONNECTED) return { call, alreadyAccepted: true };

      call.status     = CallStatus.CONNECTED;
      call.answeredAt = new Date();
      const saved = await manager.save(call);
      return { call: saved, alreadyAccepted: false };
    });
  }

  /**
   * PARTIE 9.5 — variante de acceptCall() pour le seul chemin Socket.IO
   * (CallGateway.handleCallAccept) : le gateway connaît déjà callerUserId
   * (payload) ET calleeUserId (socket.data.userId), donc localise ET
   * verrouille l'appel EN UNE SEULE requête, au lieu de l'ancien
   * findActiveCallId() (1 aller-retour) suivi d'acceptCall() (verrou par id,
   * encore 1 aller-retour) — mesuré : ce doublon coûtait ~90-100ms de plus
   * sur un chemin explicitement prioritaire (partie 9.5, "APPELÉ accepte").
   * acceptCall(userId, callId) reste INCHANGÉE — toujours utilisée telle
   * quelle par POST /calls/accept (callId explicite, pas de callerUserId
   * connu côté REST).
   *
   * @returns `null` si aucun appel actif ne correspond (équivalent du
   *   `callId` introuvable de l'ancien flux findActiveCallId()).
   */
  async acceptCallFast(
    calleeUserId: string, callerUserId: string,
  ): Promise<{ call: Call; alreadyAccepted: boolean } | null> {
    return this.dataSource.transaction(async (manager) => {
      const call = await manager.findOne(Call, {
        where:    { callerId: callerUserId, calleeId: calleeUserId },
        lock:     { mode: 'pessimistic_write' },
      });
      if (!call) return null;

      /* Idempotent : si un autre appareil du même callee a déjà accepté
         pendant qu'on attendait le verrou, ne pas réémettre answeredAt. */
      if (call.status === CallStatus.CONNECTED) return { call, alreadyAccepted: true };

      call.status     = CallStatus.CONNECTED;
      call.answeredAt = new Date();
      const saved = await manager.save(call);
      return { call: saved, alreadyAccepted: false };
    });
  }

  async rejectCall(userId: string, callId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const call = await manager.findOne(Call, { where: { id: callId }, lock: { mode: 'pessimistic_write' } });
      if (!call) return; // déjà nettoyé — idempotent
      if (call.calleeId !== userId) {
        throw new ForbiddenException('Cet appel ne vous est pas destiné.');
      }
      await this.finalizeCall(call, CallHistoryStatus.REJECTED, manager);
      await this.notifyCaller(call.callerId, call.calleeId, NotificationType.CALL_REJECTED,
        'Appel refusé', 'Votre appel a été refusé.');
    });
  }

  async endCall(userId: string, callId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const call = await manager.findOne(Call, { where: { id: callId }, lock: { mode: 'pessimistic_write' } });
      if (!call) return; // déjà nettoyé — idempotent
      if (call.callerId !== userId && call.calleeId !== userId) {
        throw new ForbiddenException('Cet appel ne vous concerne pas.');
      }

      const wasConnected = call.status === CallStatus.CONNECTED;
      await this.finalizeCall(call, wasConnected ? CallHistoryStatus.COMPLETED : CallHistoryStatus.MISSED, manager);

      /* Un appel jamais décroché qui se termine = manqué pour le destinataire. */
      if (!wasConnected) {
        await this.notifyCallee(call.calleeId, call.callerId, NotificationType.CALL_MISSED,
          'Appel manqué', 'Vous avez manqué un appel.');
      }
    });
  }

  /**
   * Lecture seule — liste des appels actifs (RINGING/CONNECTED) d'un
   * utilisateur, sans verrou ni effet de bord. Utilisé par
   * CallGateway.handleDisconnect pour décider, appel par appel, si CE
   * socket précis est bien celui qui le porte avant de le terminer (voir
   * endAllCallsForUser ci-dessous pour la distinction utilisateur/socket).
   */
  async findActiveCallsForUser(userId: string): Promise<Call[]> {
    return this.callRepo.find({ where: [{ callerId: userId }, { calleeId: userId }] });
  }

  /**
   * Nettoie tout appel actif d'un utilisateur dont le socket vient de se
   * déconnecter (fermeture d'onglet, crash, perte réseau…) — sans ça, la
   * ligne restait indéfiniment dans `calls` et `isUserBusy()` bloquait
   * TOUS les appels futurs de cet utilisateur ("Vous êtes déjà en appel"
   * en boucle, plus aucun appel possible tant qu'un admin ne nettoyait
   * pas la ligne en base à la main).
   *
   * Appelé depuis CallGateway.handleDisconnect, qui détermine EN AMONT
   * (via findActiveCallsForUser + son propre suivi socket↔appel) quels
   * callIds précis doivent réellement se terminer — un utilisateur
   * multi-appareils dont un SEUL appareil porte l'appel actif ne perd
   * plus cet appel quand un AUTRE de ses appareils se déconnecte (ancienne
   * limitation, désormais corrigée : voir CallGateway.callBindings).
   *
   * @param onlyCallIds si fourni, ne finalise QUE ces appels précis parmi
   *   ceux de l'utilisateur (sinon, comportement historique : tous).
   * @returns la liste des autres participants à notifier (`call:ended`).
   */
  async endAllCallsForUser(
    userId: string,
    onlyCallIds?: string[],
  ): Promise<{ otherUserId: string; conversationId: string | null }[]> {
    if (onlyCallIds && onlyCallIds.length === 0) return [];

    return this.dataSource.transaction(async (manager) => {
      /* FOR UPDATE — évite de finaliser une ligne qu'un accept/reject/end
         concurrent de l'autre participant est justement en train de traiter. */
      const where = onlyCallIds
        ? [{ callerId: userId, id: In(onlyCallIds) }, { calleeId: userId, id: In(onlyCallIds) }]
        : [{ callerId: userId }, { calleeId: userId }];
      const calls = await manager.find(Call, { where, lock: { mode: 'pessimistic_write' } });
      if (calls.length === 0) return [];

      const notify: { otherUserId: string; conversationId: string | null }[] = [];
      for (const call of calls) {
        const wasConnected = call.status === CallStatus.CONNECTED;
        const otherUserId  = call.callerId === userId ? call.calleeId : call.callerId;
        await this.finalizeCall(call, wasConnected ? CallHistoryStatus.COMPLETED : CallHistoryStatus.MISSED, manager);
        notify.push({ otherUserId, conversationId: call.conversationId });
      }
      return notify;
    });
  }

  /** Copie l'appel actif vers l'archive permanente puis supprime la ligne active. */
  private async finalizeCall(call: Call, status: CallHistoryStatus, manager?: EntityManager): Promise<void> {
    const historyRepo = manager ? manager.getRepository(CallHistory) : this.historyRepo;
    const callRepo     = manager ? manager.getRepository(Call)        : this.callRepo;

    const endedAt  = new Date();
    const duration = call.answeredAt
      ? Math.max(0, Math.floor((endedAt.getTime() - call.answeredAt.getTime()) / 1000))
      : 0;

    const history = historyRepo.create({
      callId:         call.id,
      callerId:       call.callerId,
      calleeId:       call.calleeId,
      conversationId: call.conversationId,
      callType:       call.callType,
      status,
      startedAt:      call.startedAt,
      answeredAt:     call.answeredAt,
      endedAt,
      duration,
    });
    await historyRepo.save(history);
    await callRepo.delete({ id: call.id });
  }

  /** Cas "occupé"/"hors ligne" : aucun appel n'a jamais réellement sonné — on journalise directement dans l'historique. */
  private async recordShortCircuit(
    callerUserId: string, dto: StartCallDto, status: CallHistoryStatus, manager?: EntityManager,
  ): Promise<void> {
    const historyRepo = manager ? manager.getRepository(CallHistory) : this.historyRepo;
    const now = new Date();
    const history = historyRepo.create({
      callId:         randomUUID(),
      callerId:       callerUserId,
      calleeId:       dto.calleeUserId,
      conversationId: dto.conversationId ?? null,
      callType:       dto.callType,
      status,
      startedAt:      now,
      answeredAt:     null,
      endedAt:        now,
      duration:       0,
    });
    await historyRepo.save(history);
  }

  // ── Historique ────────────────────────────────────────────────

  async getHistory(userId: string, page: number, limit: number) {
    const [rows, total] = await this.historyRepo.findAndCount({
      where: [{ callerId: userId }, { calleeId: userId }],
      order: { endedAt: 'DESC' },
      skip:  (page - 1) * limit,
      take:  limit,
    });

    /* Résolution EN LOT des contacts (1 requête "users" + 1 requête par
     * type de profil, au lieu de 2-3 requêtes SQL PAR ligne d'historique
     * via l'ancien getDisplayInfo() séquentiel — jusqu'à 60 requêtes pour
     * une page de 20 appels, ramené à ~7 requêtes au total). */
    const otherIds = rows.map(row => row.callerId === userId ? row.calleeId : row.callerId);
    const displayMap = await this.getDisplayInfoBulk(otherIds);

    const data = rows.map(row => {
      const direction  = row.callerId === userId ? 'outgoing' as const : 'incoming' as const;
      const otherId    = direction === 'outgoing' ? row.calleeId : row.callerId;
      const contact    = displayMap.get(otherId) ?? { name: 'Utilisateur', avatar: null };
      return {
        id:             row.id,
        conversationId: row.conversationId,
        callType:       row.callType,
        status:         row.status,
        direction,
        contactName:    contact.name,
        contactAvatar:  contact.avatar,
        startedAt:      row.startedAt,
        answeredAt:     row.answeredAt,
        endedAt:        row.endedAt,
        duration:       row.duration,
      };
    });

    return { data, total, page };
  }

  /**
   * Version BATCH de getDisplayInfo() — résout N contacts (users.id) en
   * 1 requête "users" (pour le rôle) + 1 requête par type de profil
   * présent (au maximum 5), au lieu d'un aller-retour BDD par appel de
   * l'historique. Comportement IDENTIQUE à getDisplayInfo() pour chaque
   * userId (mêmes fallbacks, même bug préexistant sur Partner.fullName
   * inexistant → 'Partenaire' générique — non modifié ici).
   */
  private async getDisplayInfoBulk(
    userIds: string[],
  ): Promise<Map<string, { name: string; avatar: string | null }>> {
    const result = new Map<string, { name: string; avatar: string | null }>();
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) return result;

    const users = await this.userRepo.find({ where: { id: In(uniqueIds) }, select: ['id', 'role'] });

    const idsByType = new Map<ConversationActorType, string[]>();
    users.forEach(u => {
      const type = this.roleToActorType(u.role);
      if (!type) return;
      if (!idsByType.has(type)) idsByType.set(type, []);
      idsByType.get(type)!.push(u.id);
    });
    const ids = (t: ConversationActorType) => idsByType.get(t) ?? [];

    const [clients, companies, deliveries, corrs, partners] = await Promise.all([
      ids(ConversationActorType.CLIENT).length
        ? this.clientRepo.find({ where: { userId: In(ids(ConversationActorType.CLIENT)) } })
        : Promise.resolve([] as Client[]),
      ids(ConversationActorType.COMPANY).length
        ? this.companyRepo.find({ where: { userId: In(ids(ConversationActorType.COMPANY)) } })
        : Promise.resolve([] as Company[]),
      ids(ConversationActorType.DELIVERY).length
        ? this.deliveryRepo.find({ where: { userId: In(ids(ConversationActorType.DELIVERY)) } })
        : Promise.resolve([] as Delivery[]),
      ids(ConversationActorType.CORRESPONDENT).length
        ? this.corrRepo.find({ where: { userId: In(ids(ConversationActorType.CORRESPONDENT)) } })
        : Promise.resolve([] as Correspondent[]),
      ids(ConversationActorType.PARTNER).length
        ? this.partnerRepo.find({ where: { userId: In(ids(ConversationActorType.PARTNER)) } })
        : Promise.resolve([] as Partner[]),
    ]);

    clients.forEach(c    => result.set((c as any).userId, { name: c?.fullName ?? 'Client', avatar: null }));
    companies.forEach(co => result.set((co as any).userId, { name: co?.companyName ?? 'Boutique', avatar: co?.logo ?? null }));
    deliveries.forEach(d => result.set((d as any).userId, { name: (d as any)?.fullName ?? 'Livreur', avatar: null }));
    corrs.forEach(c      => result.set((c as any).userId, { name: (c as any)?.fullName ?? 'Correspondant', avatar: null }));
    partners.forEach(p   => result.set((p as any).userId, { name: (p as any)?.fullName ?? 'Partenaire', avatar: null }));

    uniqueIds.forEach(id => {
      if (!result.has(id)) result.set(id, { name: 'Utilisateur', avatar: null });
    });

    return result;
  }

  // ── Notifications ─────────────────────────────────────────────

  private async notifyCaller(
    callerUserId: string, calleeUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    await this.notify(callerUserId, calleeUserId, type, title, body);
  }

  private async notifyCallee(
    calleeUserId: string, callerUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    await this.notify(calleeUserId, callerUserId, type, title, body);
  }

  private async notify(
    recipientUserId: string, actorUserId: string,
    type: NotificationType, title: string, body: string,
  ): Promise<void> {
    try {
      const recipient = await this.resolveNotificationRecipient(recipientUserId);
      if (!recipient) return;
      const actor = await this.resolveNotificationRecipient(actorUserId);

      await this.notifications.create({
        recipientType: recipient.type,
        recipientId:   recipient.id,
        actorType:     actor?.type ?? null,
        actorId:       actor?.id ?? null,
        type,
        priority:      NotificationPriority.NORMAL,
        title,
        body,
        resourceType:  'call',
      });
    } catch (e) {
      /* Une notification ratée ne doit jamais faire échouer l'appel lui-même. */
      this.logger.warn(`Échec notification d'appel (${type}) : ${(e as Error).message}`);
    }
  }
}
