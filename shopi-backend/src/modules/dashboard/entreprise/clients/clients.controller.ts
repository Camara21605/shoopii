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
  Controller, Get, Param, Query,
  UseGuards, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { ClientsService, ClientsFilters, ClientSegment } from './clients.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise/clients')
export class ClientsController {

  constructor(private readonly clientsService: ClientsService) {}

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
    return this.clientsService.getClientDetail(req.user.id, clientId);
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
    return this.clientsService.getClients(req.user.id, filters);
  }
}
