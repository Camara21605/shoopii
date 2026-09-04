/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/clients/clients.controller.ts
 *
 * ROUTES :
 *   GET /dashboard/entreprise/clients          → liste paginée + stats
 *   GET /dashboard/entreprise/clients/:id      → profil détaillé client
 *
 * SÉCURITÉ : JwtAuthGuard + RolesGuard (UserRole.COMPANY uniquement)
 * ============================================================ */

import {
  Controller, Get, Post, Param, Query, Body, Res,
  UseGuards, Req, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { ClientsService, ClientsFilters, ClientSegment } from './clients.service';
import { CrmCampaignService } from './crm-campaign.service';
import { SendCrmCampaignDto, isCrmCampaignType } from './dto/crm-campaign.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise/clients')
export class ClientsController {

  constructor(
    private readonly clientsService: ClientsService,
    private readonly crmService:     CrmCampaignService,
  ) {}

  /* ────────────────────────────────────────────────────────────
   * GET /dashboard/entreprise/clients
   *
   * Query params :
   *   - search    : string    (nom ou email)
   *   - segment   : 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné' | 'all'
   *   - source    : 'buyers' | 'abonnes' | 'all'
   *   - page      : number (défaut 1)
   *   - limit     : number (défaut 20, max 100)
   *   - sortBy    : 'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt'
   *   - sortOrder : 'ASC' | 'DESC'
   * ────────────────────────────────────────────────────────────
   */
  /* ────────────────────────────────────────────────────────────
   * GET /dashboard/entreprise/clients/:id
   *
   * Retourne le profil complet d'un client (identité, métriques,
   * 10 dernières commandes dans cette boutique, abonnement).
   * ────────────────────────────────────────────────────────────
   */
  @Get(':id')
  getClientDetail(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) clientId: string,
  ) {
    return this.clientsService.getClientDetail(req.user.actorId ?? req.user.id, clientId);
  }

  /* ════════════════════════════════════════════════════════
   * ACTIONS CRM — Newsletter VIP / Offre fidélité / Relance inactifs
   * ════════════════════════════════════════════════════════ */

  /**
   * GET /dashboard/entreprise/clients/crm/:type/preview
   * Aperçu avant envoi : nombre + échantillon de destinataires, sujet/
   * message suggérés — pour la modale de confirmation frontend. N'envoie
   * jamais rien.
   */
  @Get('crm/:type/preview')
  crmPreview(@Req() req: any, @Param('type') type: string) {
    if (!isCrmCampaignType(type)) throw new BadRequestException(`Type de campagne invalide : ${type}`);
    return this.crmService.preview(req.user.actorId ?? req.user.id, type);
  }

  /**
   * POST /dashboard/entreprise/clients/crm/:type/send
   * Envoi réel — après confirmation côté frontend. Limité pour éviter
   * qu'un compte compromis n'envoie un flot de campagnes.
   */
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Post('crm/:type/send')
  crmSend(
    @Req() req: any,
    @Param('type') type: string,
    @Body() dto: SendCrmCampaignDto,
  ) {
    if (!isCrmCampaignType(type)) throw new BadRequestException(`Type de campagne invalide : ${type}`);
    return this.crmService.send(req.user.actorId ?? req.user.id, type, dto.subject, dto.message);
  }

  /**
   * GET /dashboard/entreprise/clients/rapport/pdf
   * Génère et renvoie le rapport PDF de répartition des segments.
   */
  @Get('rapport/pdf')
  async rapportPdf(@Req() req: any, @Res() res: Response) {
    const buffer = await this.crmService.generateSegmentsPdf(req.user.actorId ?? req.user.id);
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="rapport-clients.pdf"',
      'Content-Length':      buffer.length,
    });
    res.send(buffer);
  }

  @Get()
  getClients(
    @Req() req: any,
    @Query('search')    search?:    string,
    @Query('segment')   segment?:   string,
    @Query('source')    source?:    string,
    @Query('page')      page?:      string,
    @Query('limit')     limit?:     string,
    @Query('sortBy')    sortBy?:    string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const filters: ClientsFilters = {
      search:    search?.trim() || undefined,
      segment:   segment as ClientSegment | 'all' | undefined,
      source:    source as 'buyers' | 'abonnes' | 'all' | undefined,
      page:      page    ? Math.max(1, parseInt(page))              : 1,
      limit:     limit   ? Math.min(100, Math.max(1, parseInt(limit))) : 20,
      sortBy:    sortBy  as ClientsFilters['sortBy'],
      sortOrder: sortOrder === 'ASC' ? 'ASC' : 'DESC',
    };
    return this.clientsService.getClients(req.user.actorId ?? req.user.id, filters);
  }
}
