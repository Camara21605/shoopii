/* ================================================================
 * FICHIER : src/modules/dashboard/client/correspondant-profil.controller.ts
 *   (à placer dans le dossier de ton ClientModule)
 *
 * RÔLE : Expose GET /client/correspondants/:id (profil public complet
 *        consulté par un client depuis le home).
 *
 * GUARD : OptionalJwtAuthGuard → route accessible publiquement, mais
 *   si un token valide est présent, on récupère req.user pour calculer
 *   le statut "suivi" du correspondant par le client courant.
 * ================================================================ */

import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';

import { CorrespondantProfilService } from './correspondant-profil.service';
import { CorrespondantProfilResponse } from './dto/correspondant-profil.response';
/* ⚠️ Adapte le chemin du guard à ton arborescence réelle */
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt.guard';

@Controller('client/correspondants')
export class CorrespondantProfilController {
  constructor(
    private readonly profilService: CorrespondantProfilService,
  ) {}

  /* ── GET /client/correspondants/:id ── */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProfil(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<CorrespondantProfilResponse> {
    /* userId présent uniquement si un token valide a été fourni.
       Selon ta stratégie JWT, l'id peut être sur userId / sub / id. */
    const user   = (req as any).user;
    const userId = user?.userId ?? user?.sub ?? user?.id ?? undefined;

    return this.profilService.getProfil(id, userId);
  }
}