/* ============================================================
 * FICHIER  : src/modules/support/controllers/support-client.controller.ts
 * MODULE   : Support
 * ROLE     : Endpoints du support réservés aux utilisateurs connectés.
 *
 * RESPONSABILITES :
 *   - Créer un ticket de support (POST /tickets).
 *   - Lister les tickets de l'utilisateur avec filtres (GET /tickets).
 *   - Consulter un ticket en détail avec ses messages (GET /tickets/:id).
 *   - Ajouter un message à un ticket (POST /tickets/:id/reply).
 *   - Soumettre un score CSAT après résolution (POST /tickets/:id/rate).
 *   - Uploader une pièce jointe sur un message (POST /messages/:msgId/attachments).
 *   - Lister les pièces jointes d'un message (GET /messages/:msgId/attachments).
 *   - Supprimer une de ses propres pièces jointes (DELETE /attachments/:attId).
 *
 * SECURITE :
 *   - JwtAuthGuard  : token JWT valide obligatoire sur tous les endpoints.
 *   - RolesGuard    : accessible aux rôles utilisateurs finaux uniquement
 *     (client, company, delivery, correspondent).
 *     ADMIN, SUPER_ADMIN et PARTNER utilisent SupportAgentController.
 *   - ParseUUIDPipe : validation stricte des paramètres UUID.
 *   - FileInterceptor + memoryStorage : fichier chargé en mémoire (pas de
 *     disque), buffer disponible pour la validation magic bytes.
 *   - La vérification IDOR (ownership ticket) est faite dans SupportService
 *     avant toute opération de lecture/écriture.
 *
 * DEPENDANCES :
 *   - SupportService (façade — délègue à TicketService, ConversationService,
 *     AttachmentService)
 *   - JwtAuthGuard, RolesGuard, @Roles
 *   - FileInterceptor, memoryStorage (multer)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-03
 * ============================================================ */

import {
  Controller, Get, Post, Delete, Body, Param, Query,
  Req, UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';

import { JwtAuthGuard }   from '../../../common/guards/auth.guard';
import { RolesGuard }     from '../../../common/guards/roles.guard';
import { Roles }          from '../../../common/decorators/roles.decorator';
import { UserRole }       from '../../../common/enums/user-role.enum';
import { SupportService } from '../services/support.service';

import {
  CreateSupportTicketDto,
  ReplySupportTicketDto,
  RateSupportTicketDto,
  FilterSupportTicketsDto,
} from '../dto/support.dto';

/* ── Configuration multer en mémoire ────────────────────────────
 * On ne stocke pas le fichier sur le disque (pas de path, pas de
 * cleanup à gérer). Le buffer est directement disponible dans
 * req.file.buffer pour la validation magic bytes et l'upload Cloudinary.
 *
 * memoryStorage est obligatoire pour que AttachmentService puisse
 * lire les magic bytes (les 12 premiers octets du buffer).
 * ─────────────────────────────────────────────────────────────── */
const multerMemory = { storage: memoryStorage() };

/* ─────────────────────────────────────────────────────────────
 * CONTRÔLEUR CLIENT
 * Base URL    : /support/client
 * Guard global: JwtAuthGuard + RolesGuard (utilisateurs finaux uniquement)
 *
 * ROLES AUTORISÉS : client, company, delivery, correspondent.
 * EXCLU intentionnellement : admin, super_admin, partner → ils utilisent
 *   SupportAgentController avec portée hiérarchique via SupportPermissionService.
 * ───────────────────────────────────────────────────────────── */
@Controller('support/client')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.CLIENT,
  UserRole.COMPANY,
  UserRole.DELIVERY,
  UserRole.CORRESPONDENT,
)
export class SupportClientController {
  constructor(private readonly svc: SupportService) {}

  /* ══════════════════════════════════════════════════════════
   * TICKETS
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * POST /support/client/tickets
   *
   * Crée un nouveau ticket de support.
   * Un email de confirmation est envoyé à l'utilisateur.
   *
   * BODY : CreateSupportTicketDto
   *   { type, subject, firstMessage, relatedOrderId? }
   * ────────────────────────────────────────────────────────── */
  @Post('tickets')
  create(@Req() req: any, @Body() dto: CreateSupportTicketDto) {
    const user = req.user;
    return this.svc.createTicket(
      user.id,
      user.role,
      user.firstName ?? user.email,
      user.email,
      dto,
    );
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/client/tickets
   *
   * Liste paginée des tickets de l'utilisateur connecté.
   *
   * QUERY PARAMS (optionnels) :
   *   status — filtrer par statut
   *   type   — filtrer par type
   *   page   — numéro de page (défaut: 1)
   *   limit  — par page (défaut: 10, max: 50)
   * ────────────────────────────────────────────────────────── */
  @Get('tickets')
  findAll(@Req() req: any, @Query() filters: FilterSupportTicketsDto) {
    return this.svc.findByUser(req.user.id, filters);
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/client/tickets/:id
   *
   * Détail complet d'un ticket + messages triés chronologiquement.
   * Marque unreadByUser = 0 (tickets lus lors de la consultation).
   *
   * THROWS :
   *   404 — ticket inexistant
   *   403 — ticket appartenant à un autre utilisateur
   * ────────────────────────────────────────────────────────── */
  @Get('tickets/:id')
  findOne(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOneByUser(req.user.id, id);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /support/client/tickets/:id/reply
   *
   * Ajoute un message utilisateur au thread du ticket.
   * Déclenche automatiquement la mise à jour du statut → IN_PROGRESS.
   *
   * BODY : { content: string (1–5000 chars) }
   *
   * THROWS :
   *   404 — ticket inexistant
   *   403 — ticket d'un autre utilisateur
   *   409 — ticket déjà fermé (CLOSED)
   * ────────────────────────────────────────────────────────── */
  @Post('tickets/:id/reply')
  reply(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplySupportTicketDto,
  ) {
    const user = req.user;
    return this.svc.replyByUser(user.id, user.firstName ?? user.email, id, dto);
  }

  /* ──────────────────────────────────────────────────────────
   * POST /support/client/tickets/:id/rate
   *
   * Soumet un score de satisfaction (CSAT) de 1 à 5 étoiles.
   * Disponible uniquement quand le ticket est RESOLVED ou CLOSED.
   *
   * BODY : { score: number (1–5) }
   *
   * THROWS :
   *   403 — ticket d'un autre utilisateur
   *   409 — CSAT déjà soumis
   *   422 — ticket pas encore résolu
   * ────────────────────────────────────────────────────────── */
  @Post('tickets/:id/rate')
  rate(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateSupportTicketDto,
  ) {
    return this.svc.rateTicket(req.user.id, id, dto);
  }

  /* ══════════════════════════════════════════════════════════
   * PIÈCES JOINTES
   *
   * Un utilisateur ne peut agir que sur les tickets qui lui
   * appartiennent. La vérification IDOR est faite dans SupportService.
   * ══════════════════════════════════════════════════════════ */

  /* ──────────────────────────────────────────────────────────
   * POST /support/client/tickets/:ticketId/messages/:msgId/attachments
   *
   * Upload d'une pièce jointe liée à un message spécifique.
   *
   * Format de la requête : multipart/form-data
   *   Champ "file" : le fichier binaire
   *
   * Types autorisés : PDF, JPG, PNG, WebP, MP4, WebM (max 10 MB)
   *
   * FLOW DE VALIDATION (dans SupportService + AttachmentService) :
   *   1. Ticket appartient à l'utilisateur (IDOR)
   *   2. Message appartient au ticket (IDOR cross-ticket)
   *   3. MIME type dans la liste blanche
   *   4. Taille ≤ 10 MB
   *   5. Magic bytes confirment le MIME réel
   *   6. Upload Cloudinary → enregistrement en base
   *
   * THROWS :
   *   400 — aucun fichier reçu
   *   403 — ticket d'un autre utilisateur / message cross-ticket
   *   413 — fichier trop volumineux
   *   422 — type MIME non autorisé
   *   502 — échec Cloudinary
   * ────────────────────────────────────────────────────────── */
  @Post('tickets/:ticketId/messages/:msgId/attachments')
  @UseInterceptors(FileInterceptor('file', multerMemory))
  uploadAttachment(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('msgId',    ParseUUIDPipe) msgId:    string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    /* Vérification précoce : si aucun fichier n'est envoyé dans le
     * champ multipart "file", on rejette immédiatement (400).
     * Évite d'aller jusqu'au service avec un buffer null. */
    if (!file) throw new BadRequestException('Aucun fichier reçu dans le champ "file".');

    const user = req.user;
    return this.svc.uploadAttachmentByUser(
      user.id,
      user.role,
      ticketId,
      msgId,
      file,
    );
  }

  /* ──────────────────────────────────────────────────────────
   * GET /support/client/tickets/:ticketId/messages/:msgId/attachments
   *
   * Liste toutes les pièces jointes d'un message, triées par date.
   *
   * THROWS :
   *   403 — ticket d'un autre utilisateur
   *   404 — message inexistant ou cross-ticket
   * ────────────────────────────────────────────────────────── */
  @Get('tickets/:ticketId/messages/:msgId/attachments')
  listAttachments(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('msgId',    ParseUUIDPipe) msgId:    string,
  ) {
    return this.svc.listAttachmentsByUser(req.user.id, ticketId, msgId);
  }

  /* ──────────────────────────────────────────────────────────
   * DELETE /support/client/tickets/:ticketId/attachments/:attId
   *
   * Supprime (soft delete + Cloudinary) une pièce jointe.
   *
   * RESTRICTION : un client ne peut supprimer que les pièces
   * jointes qu'il a lui-même uploadées — jamais celles d'un agent.
   *
   * THROWS :
   *   403 — ticket d'un autre utilisateur
   *   403 — pièce jointe uploadée par l'agent (pas l'utilisateur)
   *   404 — pièce jointe inexistante
   * ────────────────────────────────────────────────────────── */
  @Delete('tickets/:ticketId/attachments/:attId')
  removeAttachment(
    @Req() req: any,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Param('attId',    ParseUUIDPipe) attId:    string,
  ) {
    return this.svc.removeAttachmentByUser(req.user.id, ticketId, attId);
  }
}
