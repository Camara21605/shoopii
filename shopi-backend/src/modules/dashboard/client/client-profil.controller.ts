/* ============================================================
 * FICHIER : src/modules/dashboard/client/client-profil.controller.ts
 *
 * RÔLE : Expose les routes du profil client connecté.
 *
 * ROUTES :
 *   GET /client/profil  → profil complet du client connecté (protégé JWT)
 *
 * SÉCURITÉ : JwtAuthGuard → req.user contient { userId, role, ... }
 *            extrait du token. Seul un utilisateur connecté accède
 *            à SON propre profil.
 * ============================================================ */

import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request }                    from 'express';

import { JwtAuthGuard }         from '../../../common/guards/auth.guard';
import { ClientProfilService }  from './client-profil.service';

@Controller('client')
export class ClientProfilController {

  constructor(private readonly service: ClientProfilService) {}

  /* ─── GET /client/profil — profil du client connecté ─── */
  @Get('profil')
  @UseGuards(JwtAuthGuard)
  async getMonProfil(@Req() req: Request) {
    /* Le JwtAuthGuard injecte le user dans req.user.
       On récupère l'ID (selon ta strategy : userId ou sub ou id). */
    const u = (req as any).user;
    const userId = u?.userId ?? u?.id ?? u?.sub;
    return this.service.getMonProfil(userId);
  }
}