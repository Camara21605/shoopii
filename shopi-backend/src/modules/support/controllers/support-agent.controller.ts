/* ============================================================
 * FICHIER : src/modules/support/controllers/support-agent.controller.ts
 *
 * RÔLE : Endpoints réservés aux agents de support (ADMIN + SUPER_ADMIN + PARTNER).
 *
 * ROUTES :
 *   GET  /support/agent/tickets           → liste avec filtres (portée hiérarchique)
 *   GET  /support/agent/tickets/:id       → détail + messages (portée hiérarchique)
 *   POST /support/agent/tickets/:id/reply → répondre (ou note interne — admin/super_admin)
 *   PATCH /support/agent/tickets/:id/status   → changer le statut (admin/super_admin)
 *   PATCH /support/agent/tickets/:id/assign   → assigner à un agent (admin/super_admin)
 *   PATCH /support/agent/tickets/:id/priority/:level → priorité (admin/super_admin)
 *
 *   GET  /support/agent/stats             → statistiques (admin/super_admin)
 *   GET  /support/agent/export            → export CSV (admin/super_admin)
 *
 * PORTÉE DES RÔLES :
 *   SUPER_ADMIN → visibilité globale, toutes les actions
 *   ADMIN       → visibilité limitée aux acteurs qu'il supervise, toutes les actions
 *   PARTNER     → visibilité limitée à son réseau, lecture + réponse uniquement
 *                 (pas de changement statut/priorité/assignation, pas de notes internes)
 *
 * SÉCURITÉ :
 *   Tous les endpoints exigent :
 *     1. JwtAuthGuard → token JWT valide (cookie ou Bearer)
 *     2. RolesGuard   → rôle SUPER_ADMIN, ADMIN ou PARTNER (niveau contrôleur)
 *   Certains endpoints restreignent davantage via @Roles handler-level.
 *   La portée hiérarchique est vérifiée dans SupportService.assertAgentAccess().
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  Req, Res, UseGuards, ParseUUIDPipe, ParseEnumPipe,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';

/* multerMemory : stockage en buffer (pas de disque) pour la validation
 * magic bytes et l'upload direct vers Cloudinary depuis le buffer. */
const multerMemory = { storage: memoryStorage() };
/* Response gardé pour typer res.setHeader/res.send dans exportCsv. */
import type { Response } from 'express';

import { JwtAuthGuard }  from '../../../common/guards/auth.guard';
import { RolesGuard }    from '../../../common/guards/roles.guard';
import { Roles }         from '../../../common/decorators/roles.decorator';
import { UserRole }      from '../../../common/enums/user-role.enum';

import { SupportService }       from '../services/support.service';
import { SupportStatsService }  from '../services/support-stats.service';
import { SupportExportService } from '../services/support-export.service';

import {
  ReplySupportTicketDto,
  UpdateTicketStatusDto,
  AssignTicketDto,
  FilterSupportTicketsDto,
} from '../dto/support.dto';
import { SupportTicketPriority } from '../../../database/entities/support/support-ticket.entity';

/* ─────────────────────────────────────────────────────────────
 * CONTRÔLEUR AGENT
 * Base URL    : /support/agent
 * Roles (ctrl): SUPER_ADMIN, ADMIN, PARTNER
 * ───────────────────────────────────────────────────────────── */
@Controller('support/agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PARTNER)
export class SupportAgentController {

  constructor(
    /* Service principal : CRUD des tickets et messages */
    private readonly svc: SupportService,

    /* Service stats : agrégations analytiques (Phase 4) */
    private readonly statsSvc: SupportStatsService,

    /* Service export : génération CSV (Phase 4) */
    private readonly exportSvc: SupportExportService,
  ) {}

  /* ══════════════════════════════════════════════════════════
   * TICKETS — LECTURE (SUPER_ADMIN + ADMIN + PARTNER)
   *
   * La portée est résolue dans SupportService via
   * SupportPermissionService.resolveVisibleUserIds().
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * GET /support/agent/tickets
   *
   * SUPER_ADMIN : tous les tickets de la plateforme.
   * ADMIN       : tickets des acteurs qu'il supervise directement.
   * PARTNER     : tickets des acteurs supervisés dans son réseau.
   *
   * QUERY PARAMS :
   *   status   — 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
   *   type     — 'billing' | 'technical' | 'general' | …
   *   priority — 'low' | 'normal' | 'high' | 'urgent'
   *   search   — recherche dans référence + sujet (ILIKE)
   *   page     — numéro de page (défaut: 1)
   *   limit    — tickets par page (défaut: 20, max: 50)
   * ────────────────────────────────────────────────────────── */
  @Get('tickets')
  findAll(@Req() req: any, @Query() filters: FilterSupportTicketsDto) {
    const agent = req.user as any;
    return this.svc.findAllAsAgent(agent.actorId, agent.role, filters);
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/agent/tickets/:id
   *
   * Retourne le ticket + tous ses messages chronologiques + pièces jointes.
   * Marque unreadByAgent = 0.
   * Lance 403 si le ticket est hors de la portée de l'agent.
   * ────────────────────────────────────────────────────────── */
  @Get('tickets/:id')
  findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const agent = req.user as any;
    return this.svc.findOneAsAgent(agent.actorId, agent.role, id);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /support/agent/tickets/:id/reply
   *
   * PARTNER     : peut répondre aux tickets dans son réseau.
   *               Ne peut PAS envoyer de notes internes (?internal=true).
   * ADMIN/SA    : réponse publique ou note interne (?internal=true).
   *
   * Lance 403 si ticket hors portée, ou si PARTNER tente une note interne.
   *
   * QUERY PARAM :
   *   internal=true → note interne (non visible par l'utilisateur)
   * BODY :
   *   content   — texte du message (1 à 5000 caractères)
   *   userEmail — email du client (pour la notif email côté agent)
   * ────────────────────────────────────────────────────────── */
  @Post('tickets/:id/reply')
  reply(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplySupportTicketDto & { userEmail?: string },
    @Query('internal') internal?: string,
  ) {
    const agent = req.user as any;
    return this.svc.replyAsAgent(
      agent.actorId,
      agent.role,
      agent.id,
      agent.firstName ?? agent.email,
      body.userEmail ?? '',
      id,
      { content: body.content },
      internal === 'true',
    );
  }

  /* ══════════════════════════════════════════════════════════
   * TICKETS — MUTATIONS (SUPER_ADMIN + ADMIN uniquement)
   *
   * Les partenaires ne peuvent pas modifier le statut, l'assignation
   * ni la priorité — ces actions sont réservées au tier admin.
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * PATCH /support/agent/tickets/:id/status
   *
   * Modifie le statut du ticket.
   * BODY : { status: string, note?: string }
   * ────────────────────────────────────────────────────────── */
  @Patch('tickets/:id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  updateStatus(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    const agent = req.user as any;
    return this.svc.updateStatus(agent.actorId, agent.role, id, dto);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH /support/agent/tickets/:id/assign
   *
   * Assigne le ticket à un agent (par son userId).
   * BODY : { agentId: string (UUID) }
   * ────────────────────────────────────────────────────────── */
  @Patch('tickets/:id/assign')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  assign(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
  ) {
    const agent = req.user as any;
    return this.svc.assignTicket(agent.actorId, agent.role, id, dto);
  }

  /* ──────────────────────────────────────────────────────────
   * PATCH /support/agent/tickets/:id/priority/:level
   *
   * Modifie la priorité du ticket.
   * :level doit être 'low' | 'normal' | 'high' | 'urgent'
   * ────────────────────────────────────────────────────────── */
  @Patch('tickets/:id/priority/:level')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  setPriority(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('level', new ParseEnumPipe(SupportTicketPriority)) level: SupportTicketPriority,
  ) {
    const agent = req.user as any;
    return this.svc.setPriority(agent.actorId, agent.role, id, level);
  }

  /* ══════════════════════════════════════════════════════════
   * PIÈCES JOINTES — CÔTÉ AGENT (SUPER_ADMIN + ADMIN + PARTNER)
   *
   * La portée est vérifiée dans SupportService.assertAgentAccess().
   * PARTNER peut uploader/lister/supprimer des pièces jointes
   * uniquement sur les tickets dans son périmètre supervisé.
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * POST /support/agent/tickets/:ticketId/messages/:msgId/attachments
   * ────────────────────────────────────────────────────────── */
  @Post('tickets/:ticketId/messages/:msgId/attachments')
  @UseInterceptors(FileInterceptor('file', multerMemory))
  uploadAttachment(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('msgId',    ParseUUIDPipe) msgId:    string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu dans le champ "file".');

    const agent = req.user as any;
    return this.svc.uploadAttachmentByAgent(
      agent.actorId,
      agent.id,
      agent.role,
      ticketId,
      msgId,
      file,
    );
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/agent/tickets/:ticketId/messages/:msgId/attachments
   * ────────────────────────────────────────────────────────── */
  @Get('tickets/:ticketId/messages/:msgId/attachments')
  listAttachments(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('msgId',    ParseUUIDPipe) msgId:    string,
  ) {
    const agent = req.user as any;
    return this.svc.listAttachmentsByAgent(agent.actorId, agent.role, ticketId, msgId);
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE /support/agent/tickets/:ticketId/attachments/:attId
   *
   * L'agent peut supprimer toute pièce jointe dans sa portée.
   * ────────────────────────────────────────────────────────── */
  @Delete('tickets/:ticketId/attachments/:attId')
  removeAttachment(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('attId',    ParseUUIDPipe) attId:    string,
  ) {
    const agent = req.user as any;
    return this.svc.removeAttachmentByAgent(agent.actorId, agent.id, agent.role, ticketId, attId);
  }

  /* ══════════════════════════════════════════════════════════
   * ANALYTICS & EXPORT (SUPER_ADMIN + ADMIN uniquement)
   *
   * Les partenaires n'ont pas accès aux statistiques globales
   * ni à l'export CSV — ces données dépassent leur portée.
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * GET /support/agent/stats
   *
   * Statistiques globales : comptages par statut/type, délai moyen
   * de première réponse, score CSAT moyen, violations SLA, tendances 7j.
   * ────────────────────────────────────────────────────────── */
  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getStats() {
    return this.statsSvc.getOverview();
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/agent/export
   *
   * Génère et retourne un fichier CSV des tickets.
   * QUERY PARAMS (optionnels) : status, type, from (YYYY-MM-DD), to
   * ────────────────────────────────────────────────────────── */
  @Get('export')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async exportCsv(
    @Query('status')  status?:  string,
    @Query('type')    type?:    string,
    @Query('from')    from?:    string,
    @Query('to')      to?:      string,
    @Res() res?: Response,
  ) {
    const { csv, filename } = await this.exportSvc.generateCsv(status, type, from, to);

    res!.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res!.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res!.send(csv);
  }
}
