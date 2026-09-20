/* ============================================================
 * src/modules/dashboard/client/services/preferences.service.ts
 * FIX : helper getOrCreate avec early return
 * ============================================================ */

import { BadRequestException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository }                      from '@nestjs/typeorm';
import { DeepPartial, In, Repository }           from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserStatus } from '../../../../database/entities/user.entity';
import { RefreshToken }  from '../../../../database/entities/refresh-token.entity';
import { Localisation }  from '../../../../database/entities/localisation.entity';
import { Wallet }        from '../../../../database/entities/wallet.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { SessionService } from '../../../session/session.service';
import { WishlistService } from './wishlist.service';
import { ActiviteService } from './activite.service';
import { Client } from '../../../../database/entities/profiles/client-profile.entity';
import { AuditLog } from '../../../../database/entities/audit-log.entity';
import { NotificationPreferenceService } from '../../../notifications/services/notification-preference.service';
import { NotificationActorType, NotificationType } from '../../../../database/entities/notification/notification.entitiy';
import type { UpdatePreferencesDto } from '../../../notifications/dto/update-preferences.dto';
import {
  UpdateNotifsDto, UpdatePrivacyDto,
  UpdateApparenceDto, UpdateLangueDto,
} from '../dto/client-parametres.dto';

/* ✅ FIX — helper partagé avec early return → jamais null */
async function getOrCreate(
  clientRepo: Repository<Client>,
  userId: string,
): Promise<Client> {
  const found = await clientRepo.findOne({ where: { userId } });
  if (found) return found;                                                // ← early return
  const created = clientRepo.create({ userId } as DeepPartial<Client>);
  return clientRepo.save(created);
}

/* ════════════════════════════════════════════════════════════
 * 9. NOTIFICATIONS
 *
 * BUG CORRIGÉ — ce panneau enregistrait ses interrupteurs dans une colonne
 * JSON (client.notifSettings) que le système de notifications ne lisait
 * JAMAIS : décocher « E-mail » n'arrêtait aucun e-mail. Il pilote désormais
 * les VRAIES préférences (NotificationPreferenceService) : interrupteurs
 * globaux push / e-mail, catégories (commandes & livraisons, promotions,
 * messages, activité sociale) par canal, et mode « Ne pas déranger ».
 * Le SMS n'est pas proposé : le canal SMS n'est pas encore branché sur un
 * fournisseur (voir SmsChannelStrategy).
 * ════════════════════════════════════════════════════════════ */
type Ch = 'push' | 'email';

/** Types de notification regroupés par catégorie affichée au client. */
const NOTIF_GROUPS: Record<string, NotificationType[]> = {
  commandes: [
    NotificationType.ORDER_PLACED, NotificationType.ORDER_CONFIRMED, NotificationType.ORDER_CANCELLED,
    NotificationType.ORDER_REFUNDED, NotificationType.ORDER_STATUS_CHANGED,
    NotificationType.DELIVERY_ASSIGNED, NotificationType.DELIVERY_PICKED_UP, NotificationType.DELIVERY_EN_ROUTE,
    NotificationType.DELIVERY_ARRIVED, NotificationType.DELIVERY_COMPLETED, NotificationType.DELIVERY_FAILED,
    NotificationType.DELIVERY_RETURNED, NotificationType.RETURN_REQUESTED, NotificationType.RETURN_STATUS_CHANGED,
    NotificationType.PAYMENT_RECEIVED, NotificationType.PAYMENT_SENT, NotificationType.PAYMENT_FAILED,
    NotificationType.PAYMENT_REFUND_DONE,
  ],
  promos: [
    NotificationType.PROMO_ACTIVE, NotificationType.PROMO_ENDING_SOON, NotificationType.PROMO_ENDED,
    NotificationType.PROMO_USED, NotificationType.PROMO_LIMIT_REACHED,
    NotificationType.PRODUCT_PRICE_DROP, NotificationType.PRODUCT_BACK_IN_STOCK, NotificationType.CRM_MESSAGE,
  ],
  messages: [
    NotificationType.MESSAGE_RECEIVED, NotificationType.MESSAGE_UNREAD, NotificationType.CONVERSATION_OPENED,
    NotificationType.CALL_MISSED, NotificationType.GROUP_CALL_MISSED,
  ],
  social: [
    NotificationType.FOLLOW_NEW, NotificationType.FOLLOW_ACCEPTED, NotificationType.FOLLOW_MUTUAL,
    NotificationType.REVIEW_REPLIED, NotificationType.STORY_PUBLISHED, NotificationType.STORY_EXPIRING_SOON,
  ],
};
const CHANNELS: Ch[] = ['push', 'email'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface NotifsView {
  global: { push: boolean; email: boolean };
  dnd:    { enabled: boolean; start: string; end: string; timezone: string };
  groups: Record<string, { push: boolean; email: boolean }>;
}

@Injectable()
export class NotifsService {
  private readonly logger = new Logger(NotifsService.name);

  constructor(private readonly prefs: NotificationPreferenceService) {}

  private actor(user: User) {
    return { type: NotificationActorType.CLIENT, id: ((user as any).actorId ?? user.id) as string };
  }

  async get(user: User): Promise<NotifsView> {
    const a    = this.actor(user);
    const pref = await this.prefs.getOrCreate(a.type, a.id);

    const groups: NotifsView['groups'] = {};
    for (const [key, types] of Object.entries(NOTIF_GROUPS)) {
      groups[key] = { push: false, email: false };
      for (const t of types) {
        const eff = this.prefs.getEffectiveChannelPref(pref, t);
        for (const ch of CHANNELS) if (eff[ch]) groups[key][ch] = true;   // « actif » dès qu'un type de la catégorie l'est
      }
    }
    return {
      global: { push: pref.globalPushEnabled, email: pref.globalEmailEnabled },
      dnd:    { enabled: pref.dndEnabled, start: pref.dndStartTime ?? '22:00', end: pref.dndEndTime ?? '07:00', timezone: pref.timezone || 'Africa/Conakry' },
      groups,
    };
  }

  async update(user: User, dto: UpdateNotifsDto): Promise<NotifsView> {
    const a = this.actor(user);
    const patch: UpdatePreferencesDto = {};

    if (dto.global) {
      if (typeof dto.global.push  === 'boolean') patch.globalPushEnabled  = dto.global.push;
      if (typeof dto.global.email === 'boolean') patch.globalEmailEnabled = dto.global.email;
    }

    if (dto.dnd) {
      if (typeof dto.dnd.enabled === 'boolean') patch.dndEnabled = dto.dnd.enabled;
      if (dto.dnd.start !== undefined) {
        if (!HHMM.test(dto.dnd.start)) throw new BadRequestException('Heure de début invalide (format HH:MM).');
        patch.dndStartTime = dto.dnd.start;
      }
      if (dto.dnd.end !== undefined) {
        if (!HHMM.test(dto.dnd.end)) throw new BadRequestException('Heure de fin invalide (format HH:MM).');
        patch.dndEndTime = dto.dnd.end;
      }
      if (dto.dnd.timezone !== undefined) {
        try { new Intl.DateTimeFormat('fr', { timeZone: dto.dnd.timezone }); }
        catch { throw new BadRequestException('Fuseau horaire invalide.'); }
        patch.timezone = dto.dnd.timezone;
      }
    }

    if (dto.groups) {
      const perType: Record<string, Partial<Record<Ch, boolean>>> = {};
      for (const [key, chans] of Object.entries(dto.groups)) {
        const types = NOTIF_GROUPS[key];
        if (!types) throw new BadRequestException(`Catégorie inconnue : ${key}.`);
        for (const ch of CHANNELS) {
          const want = (chans as any)?.[ch];
          if (typeof want !== 'boolean') continue;
          /* ON = retour aux réglages par défaut de la plateforme pour ce canal (les événements
           * importants), sauf si aucun n'est actif par défaut : alors tous. OFF = tous coupés. */
          const defaults = types.map(t => this.prefs.getEffectiveChannelPref({ preferences: null } as any, t)[ch]);
          const anyDefaultOn = defaults.some(Boolean);
          types.forEach((t, i) => {
            (perType[t] ??= {})[ch] = want ? (anyDefaultOn ? defaults[i] : true) : false;
          });
        }
      }
      if (Object.keys(perType).length) patch.preferences = perType;
    }

    if (Object.keys(patch).length) await this.prefs.update(a.type, a.id, patch);
    this.logger.log(`[NOTIFS UPDATE] userId=${user.id}`);
    return this.get(user);
  }
}

/* ════════════════════════════════════════════════════════════
 * 10. CONFIDENTIALITÉ
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p   = await getOrCreate(this.clientRepo, user.id);
    const raw = (p as any).privacySettings;
    try { return { privacySettings: typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {}) }; }
    catch { return { privacySettings: {} }; }
  }

  /** Réglages connus et leur type — toute autre clé est ignorée (avant : JSON arbitraire enregistré tel quel). */
  private static readonly VISIBILITES = ['public', 'members', 'nobody'];
  private static readonly BOOLEANS    = ['historique', 'wishlist', 'perso', 'localisation'];

  async update(user: User, dto: UpdatePrivacyDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.privacySettings !== undefined) {
      let incoming: Record<string, unknown>;
      try { incoming = typeof dto.privacySettings === 'string' ? JSON.parse(dto.privacySettings) : (dto.privacySettings as any); }
      catch { throw new BadRequestException('Réglages de confidentialité invalides.'); }
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new BadRequestException('Réglages de confidentialité invalides.');

      const current = ((await this.get(user)).privacySettings ?? {}) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...current };
      if ('visibilite' in incoming) {
        if (!PrivacyService.VISIBILITES.includes(incoming.visibilite as string)) throw new BadRequestException('Visibilité du profil invalide.');
        next.visibilite = incoming.visibilite;
      }
      for (const k of PrivacyService.BOOLEANS) {
        if (!(k in incoming)) continue;
        if (typeof incoming[k] !== 'boolean') throw new BadRequestException(`Réglage « ${k} » invalide.`);
        next[k] = incoming[k];
      }
      (p as any).privacySettings = next;
    }
    await this.clientRepo.save(p);
    return { privacySettings: (p as any).privacySettings ?? {} };
  }
}

/* ════════════════════════════════════════════════════════════
 * 11. APPARENCE
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class ApparenceService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p = await getOrCreate(this.clientRepo, user.id);
    return {
      theme:        (p as any).theme        ?? 'clair',
      textSize:     (p as any).textSize     ?? 'normal',
      imageQuality: (p as any).imageQuality ?? 'haute',
    };
  }

  async update(user: User, dto: UpdateApparenceDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.textSize !== undefined) {
      if (!['normal', 'grand', 'tres_grand'].includes(dto.textSize)) throw new BadRequestException('Taille de texte invalide.');
      (p as any).textSize = dto.textSize;
    }
    await this.clientRepo.save(p);
    return { theme: (p as any).theme ?? 'sombre', textSize: (p as any).textSize ?? 'normal', imageQuality: (p as any).imageQuality ?? 'haute' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 12. LANGUE & RÉGION
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class LangueService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  async get(user: User) {
    const p = await getOrCreate(this.clientRepo, user.id);
    return {
      langue:   (p as any).langue   ?? 'fr',
      devise:   (p as any).devise   ?? 'GNF',
      timezone: (p as any).timezone ?? 'GMT+0',
    };
  }

  async update(user: User, dto: UpdateLangueDto) {
    const p = await getOrCreate(this.clientRepo, user.id);
    if (dto.langue !== undefined) {
      if (!['fr', 'en', 'ar', 'pt', 'zh'].includes(dto.langue)) throw new BadRequestException('Langue non prise en charge.');
      (p as any).langue = dto.langue;
    }
    await this.clientRepo.save(p);
    return { langue: (p as any).langue ?? 'fr', devise: (p as any).devise ?? 'GNF', timezone: (p as any).timezone ?? 'GMT+0' };
  }
}

/* ════════════════════════════════════════════════════════════
 * 13. DONNÉES — RGPD
 *
 * BUG CORRIGÉ — les boutons « Exporter » n'exportaient rien : ils consignaient
 * une demande dans audit_logs et promettaient un e-mail « sous 24 h » que
 * personne n'envoyait. L'export est désormais RÉEL et immédiat : un fichier JSON
 * (profil, adresses, commandes, liste de souhaits) que l'interface télécharge.
 * Jamais inclus : mot de passe, codes/secrets 2FA, jetons, empreintes techniques.
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class DonneesService {
  private readonly logger = new Logger(DonneesService.name);

  constructor(
    @InjectRepository(User)         private readonly userRepo:     Repository<User>,
    @InjectRepository(Client)       private readonly clientRepo:   Repository<Client>,
    @InjectRepository(AuditLog)     private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Localisation) private readonly locRepo:      Repository<Localisation>,
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    private readonly wishlistService: WishlistService,
  ) {}

  private async logExport(user: User, scope: string): Promise<void> {
    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    user.id,
      actorName:  `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      actorEmail: user.email,
      icon:       '📄',
      action:     `RGPD — export de données téléchargé (${scope})`,
      targetType: 'rgpd_request',
      targetId:   user.id,
    })).catch(() => undefined);
  }

  /** scope : all (défaut) | commandes | factures */
  async exportData(user: User, type?: string) {
    const scope = ['all', 'commandes', 'factures'].includes(type ?? '') ? (type as string) : 'all';
    const dbUser  = await this.userRepo.findOne({ where: { id: user.id } });
    if (!dbUser) throw new NotFoundException('Utilisateur introuvable.');
    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });

    const out: Record<string, unknown> = {
      exportGenereLe: new Date().toISOString(),
      type:           scope,
      compte: {
        id: dbUser.id, prenom: dbUser.firstName, nom: dbUser.lastName, email: dbUser.email,
        telephone: dbUser.phone, nomUtilisateur: dbUser.username,
        emailVerifie: dbUser.emailVerified, telephoneVerifie: dbUser.phoneVerified,
        creeLe: (dbUser as any).createdAt ?? null,
      },
    };

    if (scope === 'all') {
      out.profil = profile ? {
        dateNaissance: (profile as any).dateNaissance ?? null, genre: (profile as any).genre ?? null,
        bio: (profile as any).bio ?? null, langue: (profile as any).langue ?? null,
        confidentialite: (profile as any).privacySettings ?? null,
      } : null;
      out.adresses = (await this.locRepo.find({ where: { userId: user.id } })).map(a => ({
        libelle: a.libelle, type: a.typeAdresse, rue: a.rue, quartier: a.quartier, commune: a.commune,
        ville: a.ville, region: a.region, pays: a.pays, latitude: a.latitude, longitude: a.longitude,
        telephone: a.telephone, parDefaut: a.estDefaut, instructions: a.instructions,
      }));
      out.listeDeSouhaits = profile
        ? (await this.wishlistService.getAllForClient(profile.id).catch(() => [])).map((w: any) => ({ produit: w.nom ?? w.name ?? null, ajouteLe: w.createdAt ?? w.addedAt ?? null }))
        : [];
    }

    if (scope === 'all' || scope === 'commandes' || scope === 'factures') {
      const commandes = profile
        ? await this.commandeRepo.find({ where: { clientId: profile.id }, relations: ['items'], order: { createdAt: 'DESC' } })
        : [];
      out.commandes = commandes.map(c => scope === 'factures'
        ? {
            numero: c.numero, date: c.createdAt, statut: c.status, sousTotal: c.sousTotal, fraisLivraison: c.fraisLivraison,
            total: c.total, methodePaiement: c.methodePaiement, referencePaiement: c.refPaiement, datePaiement: c.datePaiement,
          }
        : {
            numero: c.numero, date: c.createdAt, statut: c.status, modeLivraison: c.modeLivraison,
            sousTotal: c.sousTotal, fraisLivraison: c.fraisLivraison, total: c.total,
            livraison: { prenom: c.prenomLivraison, nom: c.nomLivraison, telephone: c.telephoneLivraison, ville: c.villeLivraison, commune: c.communeLivraison, adresse: c.adresseLivraison },
            paiement: { methode: c.methodePaiement, reference: c.refPaiement, date: c.datePaiement },
            articles: (c.items ?? []).map(i => ({ produit: i.nomProduit, quantite: i.quantite, prixUnitaire: i.prixUnitaire, sousTotal: i.sousTotal })),
          });
    }

    await this.logExport(user, scope);
    this.logger.log(`[EXPORT RGPD] userId=${user.id} scope=${scope}`);
    return out;
  }

  async rapportConfidentialite(_user: User) {
    return {
      donneesCollectees: ['Nom', 'E-mail', 'Téléphone', 'Adresses de livraison', 'Commandes', 'Liste de souhaits', 'Journal de connexion'],
      partageeAvec:      ['Entreprises (pour vos commandes)', 'Livreurs et correspondants (pour la livraison)'],
      conservationDuree: 'Tant que le compte est actif ; effacées définitivement 30 jours après une demande de suppression (les commandes conservent uniquement une trace anonymisée)',
      droits:            ['Accès et export (bouton « Télécharger mes données »)', 'Rectification (Paramètres → Profil)', 'Suppression (Zone de danger)'],
      contact:           'privacy@shopi.gn',
    };
  }
}

/* ════════════════════════════════════════════════════════════
 * 14. DANGER
 *
 * BUGS CORRIGÉS :
 *   - « Désactiver » écrivait status = 'inactive' et « Supprimer » status =
 *     'deleted', valeurs absentes de l'énumération PostgreSQL : les deux
 *     actions échouaient en erreur 500 (migration 033 : valeur « inactive »).
 *   - Après l'une ou l'autre, l'utilisateur restait connecté : toutes ses
 *     sessions sont désormais fermées (refresh tokens + session Redis + jetons d'accès).
 *   - Suppression refusée s'il reste une commande en cours ou de l'argent
 *     dans le portefeuille (sinon fonds et livraisons perdus) ; les données
 *     sont effacées 30 jours plus tard (AccountPurgeCronService).
 *   - « Réinitialiser » vidait des colonnes que rien ne lit : il remet
 *     maintenant les VRAIS réglages (notifications, confidentialité, texte, langue).
 * ════════════════════════════════════════════════════════════ */
@Injectable()
export class DangerService {
  private readonly logger = new Logger(DangerService.name);

  constructor(
    @InjectRepository(User)         private readonly userRepo:     Repository<User>,
    @InjectRepository(Client)       private readonly clientRepo:   Repository<Client>,
    @InjectRepository(RefreshToken) private readonly tokenRepo:    Repository<RefreshToken>,
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(Wallet)       private readonly walletRepo:   Repository<Wallet>,
    private readonly sessionService: SessionService,
    private readonly prefs:          NotificationPreferenceService,
    private readonly journal:        ActiviteService,
  ) {}

  /* Vérifie le mot de passe actuel avant toute action irréversible ou à fort impact. */
  private async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'password'] });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const isValid = await bcrypt.compare(password ?? '', user.password);
    if (!isValid) throw new UnauthorizedException('Mot de passe incorrect. Action refusée.');
  }

  /** Ferme TOUTES les sessions du compte : refresh tokens, sessions Redis, jetons d'accès déjà émis. */
  private async closeAllSessions(userId: string): Promise<void> {
    const active = await this.tokenRepo.find({ where: { userId, revoked: false }, select: ['id', 'sessionId'] });
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true, revokedReason: 'ACCOUNT_CLOSED' });
    for (const sid of new Set(active.map(t => t.sessionId).filter((x): x is string => !!x))) {
      await this.sessionService.endSession(userId, sid).catch(() => undefined);
    }
    await this.userRepo.update(userId, { lastLogoutAt: new Date() });   // invalide les access tokens déjà émis
  }

  async desactiverCompte(user: User, password: string): Promise<{ message: string }> {
    await this.verifyPassword(user.id, password);
    await this.userRepo.update(user.id, { status: UserStatus.INACTIVE });
    this.journal.record(user.id, user.role, 'account_deactivated');
    await this.closeAllSessions(user.id);
    this.logger.warn(`[DÉSACTIVATION] userId=${user.id}`);
    return { message: 'Compte désactivé. Reconnectez-vous quand vous voulez : il sera réactivé automatiquement.' };
  }

  async reinitialiserPreferences(user: User): Promise<{ message: string }> {
    const p = await getOrCreate(this.clientRepo, user.id);
    (p as any).privacySettings = null;
    (p as any).textSize        = 'normal';
    (p as any).langue          = 'fr';
    await this.clientRepo.save(p);
    await this.prefs.resetToDefaults(NotificationActorType.CLIENT, ((user as any).actorId ?? user.id) as string);
    return { message: 'Préférences réinitialisées (notifications, confidentialité, taille du texte, langue).' };
  }

  async supprimerCompte(user: User, password: string): Promise<{ message: string }> {
    await this.verifyPassword(user.id, password);

    const profile = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (profile) {
      const enCours = await this.commandeRepo.count({
        where: { clientId: profile.id, status: In([CommandeStatus.PENDING, CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT, CommandeStatus.DISPUTED]) },
      });
      if (enCours > 0) {
        throw new BadRequestException(`Impossible de supprimer le compte : ${enCours} commande(s) en cours ou en litige. Attendez leur fin puis réessayez.`);
      }
    }
    const wallet = await this.walletRepo.findOne({ where: { userId: user.id } });
    if (wallet && (Number(wallet.balance) > 0 || Number(wallet.pendingBalance) > 0)) {
      throw new BadRequestException('Impossible de supprimer le compte : votre portefeuille contient encore des fonds. Retirez-les d’abord.');
    }

    await this.closeAllSessions(user.id);
    await this.userRepo.softDelete(user.id);
    this.logger.error(`[SUPPRESSION] userId=${user.id} — effacement définitif dans 30 jours`);
    return { message: 'Compte supprimé. Vos données personnelles seront effacées définitivement dans 30 jours.' };
  }
}
