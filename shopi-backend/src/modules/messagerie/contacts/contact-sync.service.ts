/* ============================================================
 * FICHIER : contact-sync.service.ts
 *
 * RÔLE : Orchestrateur de la synchronisation des contacts.
 *        Gère le rate limiting, les sessions, et coordonne
 *        le matching et la persistance.
 *
 * ENVOI PAR PAQUETS (application mobile) :
 *   le téléphone n'envoie que les numéros AJOUTÉS depuis la dernière fois
 *   (paquets de 300, sous la limite de 100 Ko par requête) et retire ceux
 *   qui ont disparu de son répertoire (POST /contacts/remove).
 *
 * LIMITES (Redis, par heure et par compte) :
 *   - 60 requêtes ;
 *   - 15 000 numéros testés (anti-énumération : on ne peut pas tester des
 *     numéros au hasard pour savoir qui est sur Shoneya).
 *
 * PROTECTION :
 *   - Validation que les hashes sont bien en SHA-256 (64 hex chars)
 *   - Rejet des hashes malformés avant tout accès DB
 *   - Numéros retirés du téléphone : effacés du serveur (removeContacts)
 *   - DELETE /contacts : l'utilisateur peut tout effacer à tout moment
 * ============================================================ */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { InjectRedis }       from '@nestjs-modules/ioredis';
import type { Redis }        from 'ioredis';
import { ContactSyncSession, SyncStatus } from 'src/database/entities/contacts/contact-sync-session.entity';
import { UserContact }        from 'src/database/entities/contacts/user-contact.entity';
import { User }               from 'src/database/entities/user.entity';
import { PresenceService }    from 'src/modules/messagerie/services/presence.service';
import { ContactDirectoryService } from 'src/modules/contact-directory/contact-directory.service';
import type { DirectoryActorType } from 'src/modules/contact-directory/contact-directory.service';
import { ContactMatchingService }         from './contact-matching.service';
import type {
  SyncContactsDto,
  SyncContactsResponseDto,
} from './dto/sync-contacts.dto';

/* Limites (par heure et par compte) */
const SYNC_REQ_KEY     = (uid: string) => `contacts:sync:req:${uid}`;
const SYNC_VOL_KEY     = (uid: string) => `contacts:sync:vol:${uid}`;
const MAX_REQ_PER_H    = 60;
const MAX_HASHES_PER_H = 15_000;
const SHA256_RE      = /^[a-f0-9]{64}$/i;
/** Plafond de l'onglet Contacts (un répertoire de 10 000 fiches reste lisible) */
const MAX_LISTED     = 3000;

export interface ShoneyaContact {
  /** Profil à ouvrir : POST /messagerie/conversations { targetType: type, targetId: id } */
  id:        string;
  type:      DirectoryActorType;
  userId:    string;
  name:      string;
  logo:      string | null;
  /** Nom donné au contact dans le téléphone de l'utilisateur */
  localName: string | null;
  online:    boolean;
  joinedAt:  string | null;
}

export interface ShoneyaContactsResponse {
  contacts: ShoneyaContact[];
  /** Nombre de numéros du répertoire actuellement conservés sur le serveur */
  uploaded: number;
}

@Injectable()
export class ContactSyncService {
  private readonly logger = new Logger(ContactSyncService.name);

  constructor(
    @InjectRepository(ContactSyncSession)
    private readonly sessionRepo: Repository<ContactSyncSession>,

    @InjectRepository(UserContact)
    private readonly contactRepo: Repository<UserContact>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly matching: ContactMatchingService,

    private readonly directory: ContactDirectoryService,

    private readonly presence: PresenceService,

    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // ── Synchronisation principale ──────────────────────────────

  async syncContacts(
    userId: string,
    dto:    SyncContactsDto,
  ): Promise<SyncContactsResponseDto> {
    const start = Date.now();

    /* ── 1. Rate limiting ─────────────────────────────────── */
    await this.checkRateLimit(userId, dto.contacts.length);

    /* ── 2. Validation des hashes ─────────────────────────── */
    const validContacts = dto.contacts.filter(c => SHA256_RE.test(c.hash));
    const invalidCount  = dto.contacts.length - validContacts.length;
    if (invalidCount > 0) {
      this.logger.warn(`[ContactSync] userId=${userId} → ${invalidCount} hashes invalides ignorés`);
    }

    /* ── 3. Matching ─────────────────────────────────────── */
    const hashes   = validContacts.map(c => c.hash);
    const matchMap = await this.matching.matchHashes(hashes, userId);

    /* ── 4. Persistance ──────────────────────────────────── */
    const newMatches = await this.matching.persistMatches(userId, validContacts, matchMap);

    /* ── 5. Session d'audit ──────────────────────────────── */
    const durationMs = Date.now() - start;
    void this.saveSession(userId, {
      contactsSent: validContacts.length,
      matchesFound: matchMap.size,
      newMatches,
      durationMs,
    });

    /* ── 6. Réponse ──────────────────────────────────────── */
    const results = Array.from(matchMap.values()).filter(r => r.userId !== userId);
    this.logger.log(
      `[ContactSync] userId=${userId} → ${validContacts.length} contacts, ` +
      `${matchMap.size} matches, ${newMatches} nouveaux (${durationMs}ms)`,
    );

    return {
      matched:    matchMap.size,
      newMatches,
      results,
      durationMs,
    };
  }

  // ── Annuaire « Contacts » de la messagerie ───────────────

  /**
   * Contacts du répertoire de l'utilisateur qui sont sur Shoneya, prêts à
   * ouvrir une discussion (même format que la recherche de la messagerie).
   *   - comptes ACTIFS uniquement (ContactDirectoryService) ;
   *   - jamais soi-même ni ses propres comptes liés (même numéro) ;
   *   - une seule entrée par personne (deux numéros → une ligne) ;
   *   - name = nom public Shoneya, localName = nom enregistré dans SON
   *     téléphone (affiché en second : le numéro n'est pas vérifié par SMS).
   */
  async getMyShopisContacts(userId: string): Promise<ShoneyaContactsResponse> {
    const [me, rows, total] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId }, select: ['id', 'phoneHash'] as (keyof User)[] }),
      this.contactRepo.find({
        where:  { ownerUserId: userId, matchedUserId: Not(IsNull()), isBlocked: false },
        select: ['phoneHash', 'displayName', 'matchedUserId', 'matchedAt'],
        order:  { matchedAt: 'DESC' },
        take:   MAX_LISTED,
      }),
      this.contactRepo.count({ where: { ownerUserId: userId } }),
    ]);

    const byUser = new Map<string, UserContact>();
    for (const r of rows) {
      if (!r.matchedUserId || r.matchedUserId === userId) continue;
      if (me?.phoneHash && r.phoneHash === me.phoneHash) continue;
      const prev = byUser.get(r.matchedUserId);
      if (!prev || (!prev.displayName && r.displayName)) byUser.set(r.matchedUserId, r);
    }

    const ids = [...byUser.keys()];
    const [cards, presence] = await Promise.all([
      this.directory.cardsFor(ids),
      this.presence.getBulkPresence(ids),
    ]);

    const contacts: ShoneyaContact[] = [];
    for (const [uid, row] of byUser) {
      const card = cards.get(uid);
      if (!card) continue;
      contacts.push({
        id:        card.id,
        type:      card.type,
        userId:    uid,
        name:      card.name,
        logo:      card.logo,
        localName: row.displayName?.trim() || null,
        online:    presence.get(uid)?.online ?? false,
        joinedAt:  row.matchedAt ? new Date(row.matchedAt).toISOString() : null,
      });
    }
    contacts.sort((x, y) =>
      (x.localName || x.name).localeCompare(y.localName || y.name, 'fr', { sensitivity: 'base' }));

    return { contacts, uploaded: total };
  }

  /** Retire du serveur les numéros supprimés du répertoire du téléphone. */
  async removeContacts(userId: string, hashes: string[]): Promise<{ deleted: number }> {
    const valid = [...new Set(hashes.filter(h => SHA256_RE.test(h)).map(h => h.toLowerCase()))];
    if (valid.length === 0) return { deleted: 0 };
    const res = await this.contactRepo.delete({ ownerUserId: userId, phoneHash: In(valid) });
    return { deleted: res.affected ?? 0 };
  }

  /**
   * Efface TOUT le répertoire envoyé par l'utilisateur (désactivation de la
   * synchronisation / « Supprimer mes contacts du serveur »).
   */
  async deleteMyContacts(userId: string): Promise<{ deleted: number }> {
    const res = await this.contactRepo.delete({ ownerUserId: userId });
    this.logger.log(`[ContactSync] userId=${userId} → répertoire supprimé (${res.affected ?? 0} lignes)`);
    return { deleted: res.affected ?? 0 };
  }

  // ── Limites ──────────────────────────────────────────────

  /**
   * Deux limites par heure et par compte :
   *   - nombre de requêtes (MAX_REQ_PER_H) ;
   *   - nombre de NUMÉROS testés (MAX_HASHES_PER_H) : c'est ce volume qui
   *     empêcherait de deviner « qui est sur Shoneya » en testant des numéros
   *     au hasard. Un vrai répertoire (même 10 000 fiches) passe en une fois.
   * Redis indisponible → on laisse passer (dégradé acceptable).
   */
  private async checkRateLimit(userId: string, hashes: number): Promise<void> {
    let reqCount = 0;
    let volume = 0;
    try {
      const multi = this.redis.multi()
        .incr(SYNC_REQ_KEY(userId)).expire(SYNC_REQ_KEY(userId), 3600, 'NX')
        .incrby(SYNC_VOL_KEY(userId), hashes).expire(SYNC_VOL_KEY(userId), 3600, 'NX');
      const res = await multi.exec();
      reqCount = Number(res?.[0]?.[1] ?? 0);
      volume   = Number(res?.[2]?.[1] ?? 0);
    } catch (err) {
      this.logger.warn(`[ContactSync] Rate limit Redis indisponible: ${(err as Error).message}`);
      return;
    }
    if (reqCount > MAX_REQ_PER_H || volume > MAX_HASHES_PER_H) {
      this.logger.warn(`[ContactSync] userId=${userId} limité (requêtes=${reqCount}, numéros=${volume})`);
      throw new HttpException(
        'Trop de synchronisations des contacts en peu de temps. Réessayez dans une heure.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  // ── Session d'audit ─────────────────────────────────────────

  private async saveSession(
    userId: string,
    data: { contactsSent: number; matchesFound: number; newMatches: number; durationMs: number },
  ): Promise<void> {
    try {
      const session = this.sessionRepo.create({
        userId,
        ...data,
        status: SyncStatus.COMPLETED,
      });
      await this.sessionRepo.save(session);
    } catch (err) {
      this.logger.error('[ContactSync] Erreur session:', (err as Error).message);
    }
  }
}
