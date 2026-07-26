/* ============================================================
 * FICHIER      : src/modules/event-orchestration/services/dlq.service.ts
 * MODULE       : EventOrchestrationEngine
 * ROLE         : Dead Letter Queue — événements non traitables après N retries
 * RESPONSABILITES :
 *   - Stocker les événements ayant épuisé leurs tentatives
 *   - Exposer une API de consultation et de rejeu
 *   - Alerter les administrateurs sur les entrées critiques
 *   - Maintenir un historique paginé
 * DEPENDANCES  :
 *   EventAuditService (pour incrémenter le compteur DLQ)
 * NOTE ARCHITECTURE :
 *   Le stockage est in-memory (Map) pour ne pas créer de nouvelle entité
 *   de base de données. Pour la persistance, les entrées critiques sont
 *   loggées via Logger (récupérables dans les logs de production).
 *   Une table dédiée pourrait être ajoutée via migration si nécessaire.
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 }       from 'uuid';

import { EventAuditService }  from './event-audit.service';
import {
  ShopiEvent,
  DlqEntry,
}                             from '../types/events.types';

/* ============================================================
 * CONSTANTES
 * ============================================================ */

/** Nombre maximum d'entrées en DLQ (protection mémoire) */
const DLQ_MAX_SIZE = 500;

/** TTL des entrées DLQ : 7 jours */
const DLQ_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class DlqService {

  private readonly logger = new Logger(DlqService.name);

  /** Map<dlqId, DlqEntry> — triée par ordre d'insertion */
  private readonly entries = new Map<string, DlqEntry>();

  constructor(private readonly audit: EventAuditService) {
    /* Purge automatique des entrées expirées toutes les heures */
    setInterval(() => this.purgeExpired(), 60 * 60 * 1000);
  }

  /* ==========================================================
   * AJOUT EN DLQ
   * ========================================================== */

  /**
   * Ajoute un événement non traitable à la Dead Letter Queue.
   *
   * Appelé par RetryManagerService après épuisement des tentatives.
   * Log systématiquement en ERROR pour alerter l'équipe.
   */
  async push<T>(
    event:          ShopiEvent<T>,
    subscriberName: string,
    errorMessage:   string,
    attempts:       number,
  ): Promise<DlqEntry> {
    /* Protection contre la saturation mémoire */
    if (this.entries.size >= DLQ_MAX_SIZE) {
      this.evictOldest();
    }

    const now   = new Date();
    const entry: DlqEntry = {
      id:          uuidv4(),
      event:       event as ShopiEvent<unknown>,
      subscriber:  subscriberName,
      error:       errorMessage,
      attempts,
      firstFailAt: now,
      lastFailAt:  now,
    };

    this.entries.set(entry.id, entry);
    this.audit.incrementDlq();

    /* Log structuré pour permettre l'alerte Slack/PagerDuty en prod */
    this.logger.error(
      `[DLQ] event=${event.eventName} id=${event.id} ` +
      `subscriber=${subscriberName} attempts=${attempts} error="${errorMessage}"`,
    );

    return entry;
  }

  /* ==========================================================
   * CONSULTATION
   * ========================================================== */

  /**
   * Liste paginée des entrées DLQ.
   * @param page   Page (1-based)
   * @param limit  Nombre par page (max 100)
   */
  list(page = 1, limit = 50): { items: DlqEntry[]; total: number; pages: number } {
    const take  = Math.min(limit, 100);
    const skip  = (page - 1) * take;
    const all   = Array.from(this.entries.values())
      .sort((a, b) => b.lastFailAt.getTime() - a.lastFailAt.getTime());

    return {
      items: all.slice(skip, skip + take),
      total: all.length,
      pages: Math.ceil(all.length / take),
    };
  }

  /**
   * Retourne une entrée DLQ par son ID.
   */
  findById(id: string): DlqEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Nombre total d'entrées en DLQ.
   */
  get size(): number {
    return this.entries.size;
  }

  /* ==========================================================
   * REJEU
   * ========================================================== */

  /**
   * Marque une entrée DLQ comme résolue et la supprime.
   * Le rejeu réel est délégué à l'appelant (EventOrchestrationEngine)
   * qui republiera l'événement via EventPublisherService.
   */
  markResolved(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Vide la DLQ (opération admin réservée au Super Admin).
   */
  clear(): void {
    const count = this.entries.size;
    this.entries.clear();
    this.logger.warn(`[DLQ] Vidée par un administrateur — ${count} entrées supprimées`);
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  private evictOldest(): void {
    const oldest = Array.from(this.entries.values())
      .sort((a, b) => a.firstFailAt.getTime() - b.firstFailAt.getTime())[0];
    if (oldest) {
      this.entries.delete(oldest.id);
      this.logger.warn(`[DLQ] Éviction de l'entrée la plus ancienne (DLQ pleine) id=${oldest.id}`);
    }
  }

  private purgeExpired(): void {
    const threshold = Date.now() - DLQ_TTL_MS;
    let purged = 0;
    for (const [id, entry] of this.entries.entries()) {
      if (entry.firstFailAt.getTime() < threshold) {
        this.entries.delete(id);
        purged++;
      }
    }
    if (purged > 0) {
      this.logger.log(`[DLQ] Purge : ${purged} entrée(s) expirée(s) supprimée(s)`);
    }
  }
}
