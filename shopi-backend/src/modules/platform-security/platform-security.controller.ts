/* ============================================================
 * FICHIER      : src/modules/platform-security/platform-security.controller.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Endpoints REST du moteur de sécurité, monitoring et conformité.
 * Accès strictement réservé aux rôles ADMIN et SUPER_ADMIN.
 *
 * ROUTES EXPOSÉES
 * ─────────────────────────────────────────────────────────────
 * GET  /api/platform-security/health           — ADMIN
 * GET  /api/platform-security/metrics          — ADMIN
 * GET  /api/platform-security/summary          — ADMIN
 * GET  /api/platform-security/security-events  — SUPER_ADMIN
 * GET  /api/platform-security/alerts           — ADMIN
 * POST /api/platform-security/alerts/:ruleId/resolve   — ADMIN
 * POST /api/platform-security/alerts/:ruleId/ack       — ADMIN
 * GET  /api/platform-security/incidents        — ADMIN
 * POST /api/platform-security/incidents        — ADMIN
 * GET  /api/platform-security/incidents/:id    — ADMIN
 * PATCH /api/platform-security/incidents/:id   — ADMIN
 * POST /api/platform-security/incidents/:id/timeline — ADMIN
 * POST /api/platform-security/incidents/:id/resolve  — SUPER_ADMIN
 * POST /api/platform-security/incidents/:id/close    — SUPER_ADMIN
 * GET  /api/platform-security/trace/:cid       — SUPER_ADMIN
 * GET  /api/platform-security/compliance/retention   — SUPER_ADMIN
 * GET  /api/platform-security/compliance/report      — SUPER_ADMIN
 * GET  /api/platform-security/backup/strategy        — SUPER_ADMIN
 * GET  /api/platform-security/backup/recovery-plan   — SUPER_ADMIN
 * GET  /api/platform-security/backup/checklist       — SUPER_ADMIN
 *
 * SÉCURITÉ
 * ─────────────────────────────────────────────────────────────
 * - JwtAuthGuard sur toutes les routes
 * - RolesGuard : ADMIN ou SUPER_ADMIN selon sensibilité
 * - Aucune stack trace exposée
 * - Inputs validés via ParseUUIDPipe
 *
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import {
  Controller, Get, Post, Patch,
  Param, Body, Query,
  UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { UserRole }     from '../../common/enums/user-role.enum';

import { PlatformSecurityEngine } from './platform-security.engine';
import { IncidentSeverity, IncidentStatus } from '../../database/entities/security/platform-incident.entity';
import { SecurityEventType, SecuritySeverity } from '../../database/entities/security/security-event-log.entity';

/* ============================================================
 * DTOs (inline pour éviter la prolifération de fichiers)
 * ============================================================ */

class OpenIncidentBody {
  title:              string;
  description:        string;
  severity:           IncidentSeverity;
  affectedComponents: string[];
  detectedAt?:        string; // ISO
}

class UpdateIncidentBody {
  title?:              string;
  description?:        string;
  severity?:           IncidentSeverity;
  status?:             IncidentStatus;
  affectedComponents?: string[];
  rootCause?:          string;
  remediation?:        string;
}

class ResolveIncidentBody {
  rootCause:   string;
  remediation: string;
}

class TimelineBody {
  message: string;
}

class ResolveAlertBody {
  resolvedBy?: string;
}

/* ============================================================
 * CONTROLLER
 * ============================================================ */

@Controller('platform-security')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlatformSecurityController {

  constructor(private readonly engine: PlatformSecurityEngine) {}

  /* ==========================================================
   * HEALTH
   * ========================================================== */

  /** Health check profond de tous les composants critiques. */
  @Get('health')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deepHealth() {
    return this.engine.checkHealth();
  }

  /* ==========================================================
   * MÉTRIQUES
   * ========================================================== */

  /** Instantané des métriques système en temps réel. */
  @Get('metrics')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getMetrics() {
    return this.engine.getMetricsSnapshot();
  }

  /** Résumé de sécurité pour le tableau de bord admin. */
  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getSummary() {
    return this.engine.getSecuritySummary();
  }

  /* ==========================================================
   * ÉVÉNEMENTS DE SÉCURITÉ
   * ========================================================== */

  /**
   * Liste des événements de sécurité avec filtres.
   * Accès réservé SUPER_ADMIN — données sensibles.
   */
  @Get('security-events')
  @Roles(UserRole.SUPER_ADMIN)
  async getSecurityEvents(
    @Query('type')      type?:     SecurityEventType,
    @Query('severity')  severity?: SecuritySeverity,
    @Query('actorId')   actorId?:  string,
    @Query('ip')        ip?:       string,
    @Query('from')      from?:     string,
    @Query('to')        to?:       string,
    @Query('limit')     limit?:    string,
  ) {
    return this.engine.getSecurityEvents({
      eventType:  type,
      severity,
      actorId,
      ipAddress:  ip,
      from:       from ? new Date(from) : undefined,
      to:         to   ? new Date(to)   : undefined,
      limit:      limit ? parseInt(limit, 10) : 100,
    });
  }

  /* ==========================================================
   * ALERTES
   * ========================================================== */

  /** Alertes actives triées par sévérité. */
  @Get('alerts')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  getAlerts() {
    return {
      count:  this.engine.getAlertCount(),
      alerts: this.engine.getActiveAlerts(),
    };
  }

  /** Résout une alerte active. */
  @Post('alerts/:ruleId/resolve')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  resolveAlert(
    @Param('ruleId') ruleId: string,
    @Body()          body:   ResolveAlertBody,
    @Req()           req:    Request,
  ) {
    const actor = (req as any).user?.id ?? body.resolvedBy;
    const ok    = this.engine.resolveAlert(ruleId, actor);
    return { success: ok, ruleId };
  }

  /** Acquitte une alerte (sans la résoudre). */
  @Post('alerts/:ruleId/ack')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  ackAlert(
    @Param('ruleId') ruleId: string,
    @Req()           req:    Request,
  ) {
    const userId = (req as any).user?.id ?? 'unknown';
    const ok     = this.engine.acknowledgeAlert(ruleId, userId);
    return { success: ok, ruleId };
  }

  /* ==========================================================
   * INCIDENTS
   * ========================================================== */

  /** Liste des incidents avec filtres optionnels. */
  @Get('incidents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async listIncidents(
    @Query('status')   status?:   IncidentStatus,
    @Query('severity') severity?: IncidentSeverity,
    @Query('from')     from?:     string,
    @Query('to')       to?:       string,
    @Query('limit')    limit?:    string,
  ) {
    return this.engine.listIncidents({
      status,
      severity,
      from:  from  ? new Date(from)              : undefined,
      to:    to    ? new Date(to)                : undefined,
      limit: limit ? parseInt(limit, 10)         : 50,
    });
  }

  /** Ouvre un nouvel incident. */
  @Post('incidents')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async openIncident(
    @Body() body: OpenIncidentBody,
    @Req()  req:  Request,
  ) {
    return this.engine.openIncident({
      title:              body.title,
      description:        body.description,
      severity:           body.severity,
      affectedComponents: body.affectedComponents,
      detectedAt:         body.detectedAt ? new Date(body.detectedAt) : undefined,
      createdBy:          (req as any).user?.id,
    });
  }

  /** Détail d'un incident. */
  @Get('incidents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getIncident(@Param('id', ParseUUIDPipe) id: string) {
    return this.engine.getIncident(id);
  }

  /** Met à jour un incident. */
  @Patch('incidents/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateIncident(
    @Param('id', ParseUUIDPipe) id:   string,
    @Body()                     body: UpdateIncidentBody,
    @Req()                      req:  Request,
  ) {
    return this.engine.updateIncident(id, body, (req as any).user?.id);
  }

  /** Ajoute une entrée dans la timeline de l'incident. */
  @Post('incidents/:id/timeline')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async addTimeline(
    @Param('id', ParseUUIDPipe) id:   string,
    @Body()                     body: TimelineBody,
    @Req()                      req:  Request,
  ) {
    await this.engine.addIncidentTimeline(id, body.message, (req as any).user?.id);
    return { success: true };
  }

  /** Résout un incident avec cause racine et remédiation. Réservé SUPER_ADMIN. */
  @Post('incidents/:id/resolve')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async resolveIncident(
    @Param('id', ParseUUIDPipe) id:   string,
    @Body()                     body: ResolveIncidentBody,
    @Req()                      req:  Request,
  ) {
    return this.engine.resolveIncident(
      id,
      body.rootCause,
      body.remediation,
      (req as any).user?.id ?? 'unknown',
    );
  }

  /** Clôture définitivement un incident. Réservé SUPER_ADMIN. */
  @Post('incidents/:id/close')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async closeIncident(
    @Param('id', ParseUUIDPipe) id:  string,
    @Req()                      req: Request,
  ) {
    return this.engine.closeIncident(id, (req as any).user?.id);
  }

  /* ==========================================================
   * OBSERVABILITÉ
   * ========================================================== */

  /** Trace complète d'une opération par correlationId. Réservé SUPER_ADMIN. */
  @Get('trace/:correlationId')
  @Roles(UserRole.SUPER_ADMIN)
  getTrace(@Param('correlationId') correlationId: string) {
    return this.engine.getTrace(correlationId) ?? { error: 'Trace introuvable ou expirée' };
  }

  /* ==========================================================
   * CONFORMITÉ
   * ========================================================== */

  /** Politique de rétention des données. Réservé SUPER_ADMIN. */
  @Get('compliance/retention')
  @Roles(UserRole.SUPER_ADMIN)
  getRetentionPolicy() {
    return this.engine.getRetentionPolicy();
  }

  /** Vérification de conformité en temps réel. Réservé SUPER_ADMIN. */
  @Get('compliance/check')
  @Roles(UserRole.SUPER_ADMIN)
  async runRetentionCheck() {
    return this.engine.runRetentionCheck();
  }

  /** Rapport de conformité. Réservé SUPER_ADMIN. */
  @Get('compliance/report')
  @Roles(UserRole.SUPER_ADMIN)
  async getComplianceReport(
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    return this.engine.generateComplianceReport(
      from && to ? { from: new Date(from), to: new Date(to) } : undefined,
    );
  }

  /* ==========================================================
   * SAUVEGARDES
   * ========================================================== */

  /** Stratégie de sauvegarde documentée. Réservé SUPER_ADMIN. */
  @Get('backup/strategy')
  @Roles(UserRole.SUPER_ADMIN)
  getBackupStrategy() {
    return this.engine.getBackupStrategy();
  }

  /** Plan de reprise après incident. Réservé SUPER_ADMIN. */
  @Get('backup/recovery-plan')
  @Roles(UserRole.SUPER_ADMIN)
  getRecoveryPlan() {
    return this.engine.getDisasterRecoveryPlan();
  }

  /** Checklist de vérification des sauvegardes. Réservé SUPER_ADMIN. */
  @Get('backup/checklist')
  @Roles(UserRole.SUPER_ADMIN)
  getBackupChecklist() {
    return this.engine.getBackupChecklist();
  }
}
