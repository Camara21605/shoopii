/* ============================================================
 * FICHIER : dashboard/client/returns/client-returns.controller.ts
 *
 * RÔLE : Routes de demande de retour côté client.
 *        Route base : /client/returns
 *
 * La logique métier (validation commande/article/quantité/fenêtre de
 * retour, calcul du montant) vit dans ReturnsService — partagée avec
 * le côté entreprise (returns.controller.ts) pour n'avoir qu'une seule
 * source de vérité sur les règles de retour.
 * ============================================================ */

import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Req, UseInterceptors, UploadedFile,
  ParseUUIDPipe, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { ReturnsService } from '../../entreprise/returns/services/returns.service';
import { CreateReturnDto, FilterReturnsDto } from '../../entreprise/returns/dto/returns.dto';

const MB10 = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
@Controller('client/returns')
export class ClientReturnsController {

  constructor(private readonly returnsService: ReturnsService) {}

  /* ── Créer une demande de retour ── */
  @Post()
  create(@Req() req: any, @Body() dto: CreateReturnDto) {
    return this.returnsService.createByClient(req.user.id, dto);
  }

  /* ── Liste de mes demandes de retour ── */
  @Get()
  findAll(@Req() req: any, @Query() filters: FilterReturnsDto) {
    return this.returnsService.findAllByClient(req.user.id, filters);
  }

  /* ── Détail d'une de mes demandes ── */
  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.returnsService.findOneByClient(req.user.id, id);
  }

  /* ── Joindre une preuve (photo du défaut, etc.) ── */
  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEvidence(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('type') type: string,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MB10 }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)|video\/(mp4|webm)|application\/pdf/ }),
      ],
      fileIsRequired: true,
    })) file: Express.Multer.File,
  ) {
    const evidenceType = type as 'image' | 'video' | 'document';
    if (!['image', 'video', 'document'].includes(evidenceType)) {
      throw new BadRequestException('Type de fichier invalide. Utilisez image, video ou document.');
    }
    return this.returnsService.uploadEvidenceByClient(req.user.id, id, file, evidenceType);
  }
}
