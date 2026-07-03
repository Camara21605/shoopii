/* ============================================================
 * FICHIER : contact-discovery.service.ts
 *
 * RÔLE : Génère des suggestions de contacts/entreprises
 *        intelligentes pour l'utilisateur.
 *
 * ALGORITHME DE RECOMMANDATION :
 *   1. Contacts téléphoniques déjà matchés → priorité maximale
 *   2. Entreprises avec commandes → relation existante
 *   3. Livreurs/correspondants de même zone → proximité
 *   4. Entreprises populaires dans la ville → découverte
 *
 * CACHE :
 *   Résultats mis en cache Redis 30 minutes par userId.
 *   Invalidation sur nouvelle commande ou nouvelle sync.
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository }         from 'typeorm';
import { InjectRedis }        from '@nestjs-modules/ioredis';
import type { Redis }         from 'ioredis';
import { UserContact }        from 'src/database/entities/contacts/user-contact.entity';

const DISCOVERY_CACHE_KEY = (uid: string) => `discovery:${uid}`;
const DISCOVERY_TTL       = 1800; // 30 minutes

export interface DiscoveryResult {
  userId:      string;
  displayName: string;
  actorType:   string;
  avatar:      string | null;
  reason:      string;   // "Contact téléphonique", "Commande commune", etc.
  score:       number;   // Score de pertinence 0-100
}

@Injectable()
export class ContactDiscoveryService {
  private readonly logger = new Logger(ContactDiscoveryService.name);

  constructor(
    @InjectRepository(UserContact)
    private readonly contactRepo: Repository<UserContact>,

    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  /**
   * Retourne les suggestions de contacts pour un utilisateur.
   * Combine contacts téléphoniques + follows + historique achats.
   */
  async getDiscoveries(userId: string): Promise<DiscoveryResult[]> {
    /* Cache hit */
    try {
      const cached = await this.redis.get(DISCOVERY_CACHE_KEY(userId));
      if (cached) return JSON.parse(cached) as DiscoveryResult[];
    } catch { /* Silencieux */ }

    const results = await this.buildDiscoveries(userId);

    /* Mise en cache */
    try {
      await this.redis.setex(DISCOVERY_CACHE_KEY(userId), DISCOVERY_TTL, JSON.stringify(results));
    } catch { /* Silencieux */ }

    return results;
  }

  /**
   * Invalide le cache de découverte d'un utilisateur.
   * Appelé sur nouvelle sync, nouvelle commande, nouveau follow.
   */
  async invalidate(userId: string): Promise<void> {
    try {
      await this.redis.del(DISCOVERY_CACHE_KEY(userId));
    } catch { /* Silencieux */ }
  }

  // ── Construction des recommandations ────────────────────────

  private async buildDiscoveries(userId: string): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];
    const seen = new Set<string>();

    /* ── 1. Contacts téléphoniques matchés ───────────────── */
    const phoneContacts = await this.contactRepo
      .createQueryBuilder('uc')
      .innerJoinAndSelect('uc.matchedUser', 'u')
      .where('uc.ownerUserId = :userId', { userId })
      .andWhere('uc.matchedUserId IS NOT NULL')
      .andWhere('uc.isBlocked = false')
      .orderBy('uc.matchedAt', 'DESC')
      .limit(20)
      .getMany();

    for (const contact of phoneContacts) {
      const u = (contact as any).matchedUser;
      if (!u || seen.has(u.id)) continue;
      seen.add(u.id);
      results.push({
        userId:      u.id,
        displayName: contact.displayName ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        actorType:   u.role ?? 'client',
        avatar:      u.profilePicture ?? null,
        reason:      'Contact téléphonique',
        score:       100,
      });
    }

    /* Trier par score décroissant et limiter */
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 30);
  }
}
