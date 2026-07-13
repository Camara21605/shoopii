/* ============================================================
 * FICHIER : src/modules/support/services/support-export.service.ts
 *
 * RÔLE : Générer un export CSV des tickets de support.
 *
 * FONCTIONNEMENT :
 *   - Récupère les tickets selon les filtres optionnels
 *   - Construit le fichier CSV en mémoire (string)
 *   - Retourne le CSV + le nom de fichier suggéré
 *
 * FORMAT CSV :
 *   Séparateur virgule, encodage UTF-8 avec BOM pour Excel.
 *   Le BOM (﻿) est nécessaire pour que Excel (Windows)
 *   reconnaisse correctement les caractères accentués.
 *
 * COLONNES :
 *   Référence, Date création, Type, Sujet, Statut, Priorité,
 *   Nb messages, Délai 1ère réponse (h), Note CSAT
 *
 * SÉCURITÉ :
 *   - CSV injection : toute cellule commençant par =, +, -, @
 *     est préfixée d'une apostrophe (recommandation OWASP).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from '../../../database/entities/support/support-ticket.entity';

/* Résultat retourné par la méthode generateCsv() */
export interface CsvResult {
  csv:      string; // contenu complet du fichier CSV
  filename: string; // nom de fichier suggéré pour le Content-Disposition
}

/* Caractères dangereux pour le CSV injection */
const CSV_INJECTION_CHARS = ['=', '+', '-', '@', '\t', '\r'];

@Injectable()
export class SupportExportService {

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * generateCsv()
   *
   * Récupère les tickets filtrés et les sérialise en CSV.
   *
   * PARAMÈTRES :
   *   status   — filtre optionnel par statut ('open', 'resolved'…)
   *   type     — filtre optionnel par type ('billing', 'technical'…)
   *   fromDate — date de début (ISO string : '2026-01-01')
   *   toDate   — date de fin   (ISO string : '2026-12-31')
   * ────────────────────────────────────────────────────────── */
  async generateCsv(
    status?:   string,
    type?:     string,
    fromDate?: string,
    toDate?:   string,
  ): Promise<CsvResult> {

    /* ── Construction de la requête avec filtres dynamiques ─ */
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .take(5000); // Limite de sécurité : max 5000 lignes par export

    if (status) {
      qb.andWhere('t.status = :status', { status });
    }
    if (type) {
      qb.andWhere('t.type = :type', { type });
    }
    /* Filtrage par plage de dates de création */
    if (fromDate) {
      qb.andWhere('t.createdAt >= :from', { from: new Date(fromDate) });
    }
    if (toDate) {
      /* +1 jour pour inclure toute la journée toDate */
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      qb.andWhere('t.createdAt < :to', { to: end });
    }

    const tickets = await qb.getMany();

    /* ── En-têtes des colonnes ──────────────────────────────
     * Ordre choisi pour faciliter la lecture dans Excel :
     * identifiant → dates → catégorisation → métriques
     * ─────────────────────────────────────────────────────── */
    const headers = [
      'Référence',
      'Date création',
      'Date résolution',
      'Type',
      'Sujet',
      'Statut',
      'Priorité',
      'Nb messages',
      'Délai 1ère réponse (h)',
      'Note CSAT (1-5)',
    ];

    /* ── Sérialisation de chaque ticket ─────────────────────
     * On utilise sanitize() pour éviter le CSV injection.
     * ─────────────────────────────────────────────────────── */
    const rows = tickets.map(t => [
      t.reference,
      this.fmtDate(t.createdAt),
      t.resolvedAt ? this.fmtDate(t.resolvedAt) : '',
      t.type.replace(/_/g, ' '),                   // order_platform → order platform
      this.sanitize(t.subject),
      t.status.replace(/_/g, ' '),
      t.priority,
      String(t.messageCount),
      t.firstResponseAt
        ? String(this.hoursGap(t.createdAt, t.firstResponseAt))
        : '',
      t.satisfactionScore !== null ? String(t.satisfactionScore) : '',
    ]);

    /* ── Assemblage du CSV ──────────────────────────────────
     * BOM UTF-8 ﻿ en tête pour compatibilité Excel Windows.
     * Chaque cellule est encadrée de guillemets pour éviter
     * les problèmes avec les virgules dans les sujets.
     * ─────────────────────────────────────────────────────── */
    const toCsvLine = (cells: string[]) =>
      cells.map(c => `"${c.replace(/"/g, '""')}"`).join(',');

    const csv = '﻿' + [
      toCsvLine(headers),
      ...rows.map(r => toCsvLine(r)),
    ].join('\r\n');

    /* ── Nom de fichier avec date du jour ───────────────────
     * Format : tickets-support-2026-07-03.csv
     * ─────────────────────────────────────────────────────── */
    const today    = new Date().toISOString().split('T')[0];
    const filename = `tickets-support-${today}.csv`;

    return { csv, filename };
  }

  /* ── Helpers privés ──────────────────────────────────────── */

  /**
   * Formate une date en 'JJ/MM/AAAA HH:mm' (lisible pour l'humain).
   */
  private fmtDate(d: Date): string {
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  /**
   * Calcule l'écart en heures entre deux dates (arrondi à 1 décimale).
   * Exemple : 3h30 → 3.5
   */
  private hoursGap(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.round((ms / 3_600_000) * 10) / 10;
  }

  /**
   * Protège contre le CSV injection (OWASP A1).
   * Si une cellule commence par un caractère dangereux, on préfixe
   * par une apostrophe. Excel affiche l'apostrophe mais ne l'exécute pas.
   */
  private sanitize(value: string): string {
    if (!value) return '';
    if (CSV_INJECTION_CHARS.includes(value[0])) {
      return "'" + value;
    }
    return value;
  }
}
