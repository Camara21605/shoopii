/* ============================================================
 * FICHIER      : src/modules/performance-engine/services/platform-settings-cache.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Cache Redis du singleton PlatformSettings (id=1).
 *
 * PROBLÈME RÉSOLU
 * ─────────────────────────────────────────────────────────────
 * Audit P0 : PlatformSettings est chargé depuis la base de données
 * à chaque commande, chaque calcul de commission, chaque
 * initialisation de session de paiement.
 *
 * Avec 1 000 commandes/heure → 1 000 SELECT inutiles sur une
 * table qui ne change qu'à la suite d'une action Super Admin.
 *
 * SOLUTION
 * ─────────────────────────────────────────────────────────────
 * 1. Première lecture → DB + mise en cache Redis (TTL 5 min).
 * 2. Lectures suivantes → Redis uniquement (< 1 ms vs ~5 ms DB).
 * 3. Écriture admin → invalidate() vide le cache immédiatement.
 * 4. Warm-up au démarrage → préchauffage avant le premier trafic.
 *
 * UTILISATION DANS LES SERVICES
 * ─────────────────────────────────────────────────────────────
 * Remplacer :
 *   const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
 *
 * Par :
 *   const settings = await this.platformSettingsCache.getSettings();
 *
 * INVALIDATION
 * ─────────────────────────────────────────────────────────────
 * Appeler invalidate() depuis PlatformSettingsService.update() :
 *   await this.platformSettingsCache.invalidate();
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository }                 from '@nestjs/typeorm';
import { Repository }                       from 'typeorm';

import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { RedisCacheService } from './redis-cache.service';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Clé Redis du singleton PlatformSettings */
const CACHE_KEY = 'platform_settings:1';

/** TTL : 5 minutes — raisonnable pour une config qui change rarement */
const CACHE_TTL_SEC = 300;

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class PlatformSettingsCacheService implements OnModuleInit {

  private readonly logger = new Logger(PlatformSettingsCacheService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private readonly repo: Repository<PlatformSettings>,

    private readonly cache: RedisCacheService,
  ) {}

  /* ==========================================================
   * LIFECYCLE
   * ========================================================== */

  /**
   * Préchauffage du cache au démarrage de l'application.
   * Élimine la latence du premier appel sur le chemin critique.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.warmUp();
    } catch (err) {
      /* Ne jamais crasher au démarrage pour un warm-up raté */
      this.logger.warn(`[PlatformSettingsCache] Warm-up échoué: ${(err as Error).message}`);
    }
  }

  /* ==========================================================
   * LECTURE
   * ========================================================== */

  /**
   * Retourne le singleton PlatformSettings.
   *
   * Stratégie : Cache-Aside
   *   1. Cherche dans Redis → retourne si hit
   *   2. Charge depuis DB → met en cache → retourne
   *
   * @throws Error si la base de données est inaccessible ET Redis vide
   */
  async getSettings(): Promise<PlatformSettings> {
    /* 1. Cache hit */
    const cached = await this.cache.get<PlatformSettings>(CACHE_KEY);
    if (cached) {
      return cached;
    }

    /* 2. Cache miss → charger depuis DB */
    return this.loadFromDb();
  }

  /* ==========================================================
   * INVALIDATION
   * ========================================================== */

  /**
   * Invalide immédiatement le cache.
   * Appeler après chaque écriture sur platform_settings.
   *
   * Le prochain appel à getSettings() rechargera depuis la DB.
   */
  async invalidate(): Promise<void> {
    await this.cache.del(CACHE_KEY);
    this.logger.debug('[PlatformSettingsCache] Cache invalidé');
  }

  /* ==========================================================
   * WARM-UP
   * ========================================================== */

  /**
   * Préchauffage : charge depuis DB et met en cache.
   * Idempotent — peut être appelé plusieurs fois sans effet de bord.
   */
  async warmUp(): Promise<void> {
    const alreadyCached = await this.cache.exists(CACHE_KEY);
    if (alreadyCached) return;

    await this.loadFromDb();
    this.logger.log('[PlatformSettingsCache] Cache préchauffé');
  }

  /* ==========================================================
   * STATUT
   * ========================================================== */

  /**
   * Retourne le TTL restant en secondes.
   * -1 = absent ou sans TTL. Utilisé par le contrôleur de monitoring.
   */
  async ttlSec(): Promise<number> {
    return this.cache.ttl(CACHE_KEY);
  }

  /* ==========================================================
   * HELPER PRIVÉ
   * ========================================================== */

  private async loadFromDb(): Promise<PlatformSettings> {
    const settings = await this.repo.findOne({ where: { id: 1 } });

    if (!settings) {
      /* Impossible en production — la seed crée toujours l'id=1 */
      throw new Error('[PlatformSettingsCache] Singleton platform_settings introuvable (id=1)');
    }

    /* Mise en cache asynchrone — ne bloque pas le retour */
    this.cache.set(CACHE_KEY, settings, CACHE_TTL_SEC).catch(err =>
      this.logger.warn(`[PlatformSettingsCache] Erreur écriture cache: ${(err as Error).message}`),
    );

    return settings;
  }
}
