/* ============================================================
 * FICHIER      : src/modules/financial-config-engine/services/financial-config-cache.service.ts
 * MODULE       : FinancialConfigEngine
 * ROLE         : Cache in-memory pour PlatformSettings.
 *                Évite les lectures répétées en base de données
 *                sur chaque appel des moteurs financiers.
 * RESPONSABILITES :
 *   - Stocker l'objet PlatformSettings avec un TTL de 5 minutes
 *   - Invalider le cache immédiatement après toute écriture
 *   - Fournir les méthodes get / set / invalidate
 * DEPENDANCES  :
 *   PlatformSettings (database/entities)
 * UTILISE PAR  :
 *   FinancialConfigReaderService → lecture via cache
 *   FinancialConfigWriterService → invalidation après écriture
 * NOTE TECHNIQUE :
 *   Implémentation Map en mémoire — pas de Redis pour ce cache.
 *   Acceptable car PlatformSettings ne change que rarement (admin only).
 *   En cas de déploiement multi-instance, l'invalidation ne se propage pas
 *   aux autres pods : chaque pod dispose de son propre cache avec TTL 5 min.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';

/** Durée de vie du cache en millisecondes (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Clé unique du singleton PlatformSettings dans le cache */
const SETTINGS_KEY = 'platform_settings';

/** Structure interne d'une entrée de cache */
interface CacheEntry {
  data:      PlatformSettings;
  expiresAt: number;  // timestamp epoch (ms)
}

@Injectable()
export class FinancialConfigCacheService {

  /** Map interne — une seule entrée en pratique (singleton) */
  private readonly store: Map<string, CacheEntry> = new Map();

  /* ----------------------------------------------------------
   * get()
   *
   * Retourne la valeur en cache si elle existe et n'est pas
   * expirée. Retourne null sinon (forçant un rechargement DB).
   * ---------------------------------------------------------- */
  get(key: string = SETTINGS_KEY): PlatformSettings | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  /* ----------------------------------------------------------
   * set()
   *
   * Met en cache les PlatformSettings avec le TTL configuré.
   * ---------------------------------------------------------- */
  set(data: PlatformSettings, key: string = SETTINGS_KEY): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /* ----------------------------------------------------------
   * invalidate()
   *
   * Supprime une entrée du cache.
   * Appelé immédiatement après toute écriture sur PlatformSettings.
   * ---------------------------------------------------------- */
  invalidate(key: string = SETTINGS_KEY): void {
    this.store.delete(key);
  }

  /* ----------------------------------------------------------
   * invalidateAll()
   *
   * Vide le cache entier.
   * Utilisé lors d'une opération de rollback ou d'un bootstrap.
   * ---------------------------------------------------------- */
  invalidateAll(): void {
    this.store.clear();
  }

  /* ----------------------------------------------------------
   * isValid()
   *
   * Vérifie si le cache est frais (non expiré).
   * Utile pour les métriques / health checks.
   * ---------------------------------------------------------- */
  isValid(key: string = SETTINGS_KEY): boolean {
    const entry = this.store.get(key);
    return !!entry && Date.now() <= entry.expiresAt;
  }

  /* ----------------------------------------------------------
   * ttlMs()
   *
   * Retourne le temps restant avant expiration (ms).
   * 0 si expiré ou absent.
   * ---------------------------------------------------------- */
  ttlMs(key: string = SETTINGS_KEY): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }
}
