/* ============================================================
 * FICHIER : contact-sync.service.ts
 *
 * RÔLE : Orchestrateur de la synchronisation des contacts.
 *        Gère le rate limiting, les sessions, et coordonne
 *        le matching et la persistance.
 *
 * RATE LIMITING :
 *   - Max 3 syncs complètes par heure par utilisateur
 *   - Sync incrémentale : max 10 par heure
 *   - Vérification via Redis TTL
 *
 * PROTECTION :
 *   - Validation que les hashes sont bien en SHA-256 (64 hex chars)
 *   - Rejet des hashes malformés avant tout accès DB
 * ============================================================ */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository }  from '@nestjs/typeorm';
import { Repository }        from 'typeorm';
import { InjectRedis }       from '@nestjs-modules/ioredis';
import type { Redis }        from 'ioredis';
import { ContactSyncSession, SyncStatus } from 'src/database/entities/contacts/contact-sync-session.entity';
import { ContactMatchingService }         from './contact-matching.service';
import type {
  SyncContactsDto,
  SyncContactsResponseDto,
} from './dto/sync-contacts.dto';

/* Rate limiting */
const SYNC_FULL_KEY  = (uid: string) => `contacts:sync:full:${uid}`;
const SYNC_INCR_KEY  = (uid: string) => `contacts:sync:incr:${uid}`;
const MAX_FULL_PER_H = 3;
const MAX_INCR_PER_H = 10;
const SHA256_RE      = /^[a-f0-9]{64}$/i;

@Injectable()
export class ContactSyncService {
  private readonly logger = new Logger(ContactSyncService.name);

  constructor(
    @InjectRepository(ContactSyncSession)
    private readonly sessionRepo: Repository<ContactSyncSession>,

    private readonly matching: ContactMatchingService,

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
    await this.checkRateLimit(userId, dto.incremental ?? false);

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
    const results = Array.from(matchMap.values());
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

  // ── Méthode de découverte ────────────────────────────────────

  /**
   * Retourne les contacts de l'utilisateur qui sont sur Shopi.
   * Utilisé pour afficher le "répertoire" dans la messagerie.
   */
  async getMyShopisContacts(userId: string) {
    return this.sessionRepo.manager
      .createQueryBuilder()
      .from('user_contacts', 'uc')
      .innerJoin('users', 'u', 'u.id = uc.matched_user_id')
      .where('uc.owner_user_id = :userId', { userId })
      .andWhere('uc.matched_user_id IS NOT NULL')
      .andWhere('uc.is_blocked = false')
      .select([
        'uc.matched_user_id AS "userId"',
        'uc.display_name    AS "displayName"',
        'uc.matched_at      AS "matchedAt"',
        'u.role             AS "actorType"',
      ])
      .limit(500)
      .getRawMany();
  }

  // ── Rate limiting ────────────────────────────────────────────

  private async checkRateLimit(userId: string, incremental: boolean): Promise<void> {
    try {
      const key    = incremental ? SYNC_INCR_KEY(userId) : SYNC_FULL_KEY(userId);
      const limit  = incremental ? MAX_INCR_PER_H : MAX_FULL_PER_H;
      const count  = await this.redis.incr(key);

      if (count === 1) {
        await this.redis.expire(key, 3600);
      }

      if (count > limit) {
        throw new HttpException(
          `Synchronisation limitée à ${limit} fois par heure. Réessayez plus tard.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw err;
      /* Redis indisponible → on laisse passer (dégradé acceptable) */
      this.logger.warn(`[ContactSync] Rate limit Redis indisponible: ${(err as Error).message}`);
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
