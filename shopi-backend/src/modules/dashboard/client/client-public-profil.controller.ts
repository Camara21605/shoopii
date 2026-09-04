/* ============================================================
 * FICHIER : src/modules/dashboard/client/client-public-profil.controller.ts
 *
 * RÔLE : Expose GET /client/profils/:id — profil public d'un client,
 *        consulté par un autre utilisateur (mirror de
 *        correspondant-profil.controller.ts).
 *
 * GUARD : OptionalJwtAuthGuard → accessible publiquement, mais si un
 *   token valide est présent on récupère l'id du visiteur pour
 *   appliquer Client.privacySettings.visibilite ('members'/propriétaire).
 * ============================================================ */

import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ClientPublicProfilService, ClientPublicProfilResponse } from './client-public-profil.service';
import { OptionalJwtAuthGuard } from '../../../common/guards/optional-jwt.guard';

@Controller('client/profils')
export class ClientPublicProfilController {
  constructor(
    private readonly profilService: ClientPublicProfilService,
  ) {}

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getProfil(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<ClientPublicProfilResponse> {
    const viewerUserId = (req as any).user?.id as string | undefined;
    return this.profilService.getProfil(id, viewerUserId);
  }
}
