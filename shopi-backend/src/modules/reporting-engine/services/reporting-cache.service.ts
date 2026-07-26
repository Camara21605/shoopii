/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/reporting-cache.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Cache in-memory pour les résultats de rapports
 * RESPONSABILITES :
 *   - Stocker les KPIs et rapports calculés en mémoire (Map JS)
 *   - TTL de 10 minutes par entrée (rapports moins fréquents que config)
 *   - Invalidation par clé, par préfixe ou globale
 *   - Clés de cache structurées : section:userId:period:dateHash
 *   - Aucune dépendance Redis (cache local par pod)
 * DEPENDANCES  : Aucune (vanilla TypeScript)
 * NOTE MULTI-INSTANCE :
 *   En déploiement multi-pods, chaque instance a son cache local.
 *   La convergence se fait naturellement à l'expiration du TTL.
 *   Pour une cohérence stricte entre pods, remplacer ce service
 *   par un adapter Redis en conservant la même interface.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/**
 * Durée de vie d'une entrée de cache.
 * 10 minutes — les rapports sont moins volatiles que la config.
 * Les dashboards super admin peuvent tolérer des données de 10 min.
 */
const CACHE_TTL_MS = 10 * 60 * 1_000; // 10 minutes

/**
 * TTL réduit pour les KPIs "temps réel" (alertes, overview super admin).
 * 2 minutes pour les données sensibles aux anomalies.
 */
const CACHE_TTL_REALTIME_MS = 2 * 60 * 1_000;

/* ============================================================
 * TYPES INTERNES
 * ============================================================ */

interface CacheEntry<T = unknown> {
  data:      T;
  expiresAt: number; // timestamp ms
  createdAt: number;
}

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class ReportingCacheService {

  /**
   * Stockage interne.
   * Clé : string structurée (section:userId:period:dateHash)
   * Valeur : entrée avec données + expiration
   */
  private readonly store = new Map<string, CacheEntry>();

  /* ==========================================================
   * API PUBLIQUE
   * ========================================================== */

  /**
   * Récupère une entrée du cache si elle est encore valide.
   * Retourne undefined si absente ou expirée.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  /**
   * Stocke une valeur avec TTL standard (10 minutes).
   */
  set<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
      createdAt: Date.now(),
    });
  }

  /**
   * Stocke une valeur avec TTL "temps réel" réduit (2 minutes).
   * Utilisé pour les alertes et les KPIs sensibles aux anomalies.
   */
  setRealtime<T>(key: string, data: T): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_REALTIME_MS,
      createdAt: Date.now(),
    });
  }

  /**
   * Invalide une entrée spécifique.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalide toutes les entrées dont la clé commence par un préfixe.
   * Utile pour invalider tout le cache d'un utilisateur ou d'une section.
   * Exemple : invalidatePrefix('overview:') → invalide tous les overviews
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Vide tout le cache.
   * Appelé lors d'un changement de configuration financière majeur.
   */
  invalidateAll(): void {
    this.store.clear();
  }

  /**
   * Retourne vrai si la clé est présente et non expirée.
   */
  isValid(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    return Date.now() <= entry.expiresAt;
  }

  /**
   * Retourne le temps restant en millisecondes avant expiration.
   * Retourne 0 si la clé est absente ou expirée.
   */
  ttlMs(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.expiresAt - Date.now());
  }

  /**
   * Statistiques du cache pour monitoring.
   */
  stats(): { size: number; keys: string[] } {
    this.evictExpired();
    return { size: this.store.size, keys: [...this.store.keys()] };
  }

  /* ==========================================================
   * CONSTRUCTEURS DE CLÉS
   * Centralise la convention de nommage des clés de cache.
   * ========================================================== */

  /**
   * Clé pour un KPI global (overview).
   * Format : overview:{userId}:{dateFromHash}:{dateToHash}
   */
  static keyOverview(userId: string, dateFrom: Date, dateTo: Date): string {
    return `overview:${userId}:${hashDate(dateFrom)}:${hashDate(dateTo)}`;
  }

  /**
   * Clé pour un dashboard par rôle.
   * Format : dashboard:{role}:{userId}:{dateFromHash}:{dateToHash}
   */
  static keyDashboard(role: string, userId: string, dateFrom: Date, dateTo: Date): string {
    return `dashboard:${role}:${userId}:${hashDate(dateFrom)}:${hashDate(dateTo)}`;
  }

  /**
   * Clé pour une section KPI spécifique.
   * Format : kpi:{section}:{userId}:{dateFromHash}:{dateToHash}
   */
  static keyKpi(section: string, userId: string, dateFrom: Date, dateTo: Date): string {
    return `kpi:${section}:${userId}:${hashDate(dateFrom)}:${hashDate(dateTo)}`;
  }

  /**
   * Clé pour un rapport généré.
   * Format : report:{type}:{section}:{hash}
   */
  static keyReport(type: string, section: string, hash: string): string {
    return `report:${type}:${section}:${hash}`;
  }

  /**
   * Clé pour une série temporelle.
   * Format : ts:{section}:{metric}:{granularity}:{dateFromHash}:{dateToHash}
   */
  static keyTimeSeries(
    section: string,
    metric: string,
    granularity: string,
    dateFrom: Date,
    dateTo: Date,
  ): string {
    return `ts:${section}:${metric}:${granularity}:${hashDate(dateFrom)}:${hashDate(dateTo)}`;
  }

  /* ==========================================================
   * NETTOYAGE
   * ========================================================== */

  /**
   * Supprime les entrées expirées du store.
   * Appelé périodiquement depuis les méthodes publiques pour éviter
   * les fuites mémoire en production (longue durée de vie du process).
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}

/* ============================================================
 * HELPER
 * ============================================================ */

/**
 * Hash compact d'une date pour les clés de cache.
 * Format : YYYYMMDD (suffisant pour distinguer les périodes).
 */
function hashDate(date: Date): string {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}
