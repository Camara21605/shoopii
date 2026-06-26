/* ============================================================
 * FICHIER : src/modules/suivis/controllers/mes-abonnements.controller.ts
 *
 * RÔLE : Expose les abonnements du client connecté pour la page profil.
 *
 * ROUTE :
 *   GET /suivis/mes-abonnements
 *   → { boutiques[], livreurs[], correspondants[] }
 *
 * SÉCURITÉ : JWT obligatoire (le client voit SES abonnements).
 * ============================================================ */

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request }                    from 'express';

import { JwtAuthGuard }          from '../../../common/guards/auth.guard';
import { MesAbonnementsService } from '../services/mes-abonnements.service';

@Controller('suivis/mes-abonnements')
export class MesAbonnementsController {

  constructor(private readonly service: MesAbonnementsService) {}

  /* ─── GET /suivis/mes-abonnements ─── */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getMesAbonnements(@Req() req: Request) {
    const u = (req as any).user;
    const userId = u?.userId ?? u?.id ?? u?.sub;
    return this.service.getMesAbonnements(userId);
  }
}