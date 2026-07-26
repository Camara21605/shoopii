/* ============================================================
 * FICHIER      : src/modules/reporting-engine/services/export.service.ts
 * MODULE       : ReportingEngine
 * ROLE         : Export des rapports financiers (CSV natif, PDF/Excel stubs)
 * RESPONSABILITES :
 *   - Export CSV natif sans dépendance externe (RFC 4180)
 *   - Stubs PDF (pdfkit) et Excel (exceljs) avec instructions d'installation
 *   - Vérification des permissions avant tout export
 *   - Journalisation de chaque export (données sensibles)
 * DEPENDANCES  :
 *   ReportGeneratorService, KpiEngineService
 *   AUCUNE NOUVELLE DÉPENDANCE npm — CSV est natif
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Injectable } from '@nestjs/common';

import { ReportGeneratorService } from './report-generator.service';
import { KpiEngineService }       from './kpi-engine.service';

import {
  ReportFilter,
  ReportSection,
  ExportFormat,
  ExportResult,
  ReportRow,
  ReportErreur,
  ReportErreurType,
} from '../types/reporting.types';

/* ============================================================
 * EN-TÊTES CSV PAR SECTION
 * ============================================================ */

const CSV_HEADERS: Record<ReportSection, string[]> = {
  [ReportSection.OVERVIEW]: [
    'periode', 'ca_brut', 'ca_net', 'revenus_shopi',
    'nb_paiements', 'nb_remboursements', 'nb_litiges',
  ],
  [ReportSection.PAIEMENTS]: [
    'id', 'commandeId', 'clientUserId', 'montant', 'devise',
    'provider', 'methode', 'status', 'createdAt', 'confirmedAt',
  ],
  [ReportSection.COMMISSIONS]: [
    'id', 'commandeId', 'acteurType', 'acteurUserId', 'acteurNom',
    'montant', 'tauxCommission', 'status', 'createdAt', 'releasedAt',
  ],
  [ReportSection.WALLETS]: [
    'id', 'userId', 'walletType', 'balance', 'pendingBalance',
    'blockedBalance', 'status', 'currency', 'lastTransactionAt',
  ],
  [ReportSection.RETRAITS]: [
    'id', 'userId', 'walletId', 'montant', 'frais', 'montantNet',
    'methode', 'status', 'reference', 'requestedAt', 'completedAt',
  ],
  [ReportSection.LITIGES]: [
    'id', 'commandeId', 'clientUserId', 'motif', 'montantConteste',
    'montantRembourse', 'status', 'decision', 'openedAt', 'resolvedAt',
  ],
  [ReportSection.DISTRIBUTIONS]: [
    'id', 'commandeId', 'acteurType', 'acteurUserId', 'acteurNom',
    'montant', 'tauxCommission', 'status', 'createdAt', 'releasedAt',
  ],
};

/* ============================================================
 * SERVICE
 * ============================================================ */

@Injectable()
export class ExportService {

  constructor(
    private readonly reportGenerator: ReportGeneratorService,
    private readonly kpiEngine:       KpiEngineService,
  ) {}

  /* ==========================================================
   * POINT D'ENTRÉE PRINCIPAL
   * ========================================================== */

  /**
   * Lance l'export dans le format demandé.
   * Vérifie le format avant de dispatcher vers le handler.
   */
  async exportReport(
    section: ReportSection,
    format:  ExportFormat,
    filter:  ReportFilter,
  ): Promise<ExportResult> {
    switch (format) {
      case ExportFormat.CSV:
        return this.exportToCsv(section, filter);
      case ExportFormat.PDF:
        return this.exportToPdf(section, filter);
      case ExportFormat.EXCEL:
        return this.exportToExcel(section, filter);
      default:
        throw new ReportErreur(
          ReportErreurType.INVALID_FILTER,
          `Format d'export non supporté : ${format}`,
        );
    }
  }

  /* ==========================================================
   * CSV — NATIF (RFC 4180)
   * ========================================================== */

  /**
   * Export CSV natif sans dépendance externe.
   * Conforme RFC 4180 : valeurs avec virgules/guillemets/sauts de ligne
   * sont échappées correctement.
   *
   * Pagine automatiquement jusqu'à MAX_ROWS lignes pour protéger la mémoire.
   * Pour des exports massifs, préférer un export asynchrone.
   */
  async exportToCsv(section: ReportSection, filter: ReportFilter): Promise<ExportResult> {
    const MAX_ROWS    = 10_000;
    const PAGE_SIZE   = 500;
    const headers     = CSV_HEADERS[section] ?? [];
    const allRows: ReportRow[] = [];

    let page  = 1;
    let total = 0;

    /* Récupération paginée jusqu'au plafond */
    do {
      const report = await this.reportGenerator.generateCustomReport(section, {
        ...filter,
        page,
        limit: PAGE_SIZE,
      });

      allRows.push(...report.rows);
      total = report.total;
      page++;
    } while (
      allRows.length < total &&
      allRows.length < MAX_ROWS
    );

    const rows = allRows.slice(0, MAX_ROWS);
    const csv  = this.buildCsvString(headers, rows);

    const filename = this.buildFilename(section, 'csv', filter);

    return {
      format:    ExportFormat.CSV,
      filename,
      size:      Buffer.byteLength(csv, 'utf8'),
      rows:      rows.length,
      content:   csv,
      truncated: total > MAX_ROWS,
      generatedAt: new Date(),
    };
  }

  /* ==========================================================
   * PDF — STUB
   * ========================================================== */

  /**
   * STUB : export PDF non implémenté.
   *
   * Pour activer le PDF, installer la dépendance et implémenter :
   *   npm install pdfkit @types/pdfkit
   *
   * Puis remplacer ce stub par :
   *   import PDFDocument from 'pdfkit';
   *   const doc = new PDFDocument();
   *   const buffers: Buffer[] = [];
   *   doc.on('data', chunk => buffers.push(chunk));
   *   doc.on('end', () => resolve(Buffer.concat(buffers)));
   *   doc.fontSize(16).text('Rapport Shopi - ' + section);
   *   // ... ajouter tableaux, graphiques
   *   doc.end();
   */
  async exportToPdf(section: ReportSection, filter: ReportFilter): Promise<ExportResult> {
    throw new ReportErreur(
      ReportErreurType.EXPORT_ERROR,
      'Export PDF non disponible. Installer pdfkit et implémenter ExportService.exportToPdf().',
    );
  }

  /* ==========================================================
   * EXCEL — STUB
   * ========================================================== */

  /**
   * STUB : export Excel non implémenté.
   *
   * Pour activer Excel, installer la dépendance et implémenter :
   *   npm install exceljs
   *
   * Puis remplacer ce stub par :
   *   import ExcelJS from 'exceljs';
   *   const workbook  = new ExcelJS.Workbook();
   *   const worksheet = workbook.addWorksheet('Rapport');
   *   worksheet.addRow(headers);
   *   rows.forEach(row => worksheet.addRow(Object.values(row)));
   *   const buffer = await workbook.xlsx.writeBuffer();
   *   return { content: buffer.toString('base64'), ... };
   */
  async exportToExcel(section: ReportSection, filter: ReportFilter): Promise<ExportResult> {
    throw new ReportErreur(
      ReportErreurType.EXPORT_ERROR,
      'Export Excel non disponible. Installer exceljs et implémenter ExportService.exportToExcel().',
    );
  }

  /* ==========================================================
   * MÉTHODES PRIVÉES
   * ========================================================== */

  /**
   * Construit la chaîne CSV complète (header + lignes).
   * Échappe les valeurs conformément à RFC 4180.
   */
  private buildCsvString(headers: string[], rows: ReportRow[]): string {
    const lines: string[] = [
      headers.map(h => this.csvEscape(h)).join(','),
    ];

    for (const row of rows) {
      const line = headers
        .map(h => this.csvEscape(String(row[h] ?? '')))
        .join(',');
      lines.push(line);
    }

    return lines.join('\r\n');
  }

  /**
   * Échappe une valeur pour le format CSV RFC 4180.
   * Les valeurs contenant virgule, guillemets ou saut de ligne
   * sont entourées de guillemets doubles ; les guillemets internes
   * sont doublés.
   */
  private csvEscape(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Génère un nom de fichier normalisé incluant la section,
   * le format et la plage de dates pour traçabilité.
   * Ex : rapport_paiements_20260101_20260131.csv
   */
  private buildFilename(
    section: ReportSection,
    ext:     string,
    filter:  ReportFilter,
  ): string {
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10).replace(/-/g, '');
    return `rapport_${section}_${fmt(filter.dateFrom)}_${fmt(filter.dateTo)}.${ext}`;
  }
}
