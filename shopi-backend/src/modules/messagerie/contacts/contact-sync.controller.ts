/* ============================================================
 * FICHIER : contact-sync.controller.ts
 *
 * Base URL : /api/contacts
 * Auth     : JWT obligatoire
 * ============================================================ */

import {
  Controller, Post, Get, Body, Req,
  UseGuards, HttpCode, HttpStatus, Delete, Param, ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard }        from 'src/common/guards/auth.guard';
import { ContactSyncService }  from './contact-sync.service';
import { ContactDiscoveryService } from './contact-discovery.service';
import { SyncContactsDto }     from './dto/sync-contacts.dto';

@Controller('contacts')
@UseGuards(JwtAuthGuard)
export class ContactSyncController {

  constructor(
    private readonly syncSvc:      ContactSyncService,
    private readonly discoverySvc: ContactDiscoveryService,
  ) {}

  private userId(req: Request): string {
    return (req as any).user?.id;
  }

  /**
   * POST /contacts/sync
   *
   * Synchronise les contacts téléphoniques.
   * Corps : { contacts: [{ hash, displayName? }], incremental?: true }
   *
   * PROTECTION VIE PRIVÉE :
   *   Seuls les SHA-256 de numéros normalisés sont acceptés.
   *   Aucun numéro en clair ne doit jamais être envoyé.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncContacts(
    @Req()  req: Request,
    @Body() dto: SyncContactsDto,
  ) {
    return this.syncSvc.syncContacts(this.userId(req), dto);
  }

  /**
   * GET /contacts/shopi
   *
   * Retourne la liste des contacts de l'utilisateur
   * qui sont déjà inscrits sur Shopi.
   */
  @Get('shopi')
  async getMyShopisContacts(@Req() req: Request) {
    return this.syncSvc.getMyShopisContacts(this.userId(req));
  }

  /**
   * GET /contacts/discover
   *
   * Suggestions de contacts intelligentes.
   * Résultats mis en cache 30 minutes.
   */
  @Get('discover')
  async discover(@Req() req: Request) {
    return this.discoverySvc.getDiscoveries(this.userId(req));
  }

  /**
   * DELETE /contacts/discover/cache
   *
   * Invalide le cache de découverte (ex: après nouvelle sync).
   */
  @Delete('discover/cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invalidateDiscovery(@Req() req: Request): Promise<void> {
    await this.discoverySvc.invalidate(this.userId(req));
  }
}
