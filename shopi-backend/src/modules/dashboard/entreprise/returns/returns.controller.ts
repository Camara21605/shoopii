/* ============================================================
 * FICHIER : returns/returns.controller.ts
 *
 * RÔLE : Routes de gestion des retours côté entreprise.
 *        Route base : /dashboard/entreprise/returns
 * ============================================================ */

import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Req, UseInterceptors, UploadedFile,
  ParseUUIDPipe, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard }   from 'src/common/guards/roles.guard';
import { Roles }        from 'src/common/decorators/roles.decorator';
import { UserRole }     from 'src/common/enums/user-role.enum';

import { ReturnsService }      from './services/returns.service';
import { ReturnsStatsService } from './services/returns-stats.service';

import {
  AcceptReturnDto, RefuseReturnDto, RefundReturnDto,
  AddReturnNoteDto, FilterReturnsDto, UpdateReturnPriorityDto,
} from './dto/returns.dto';

const MB5  = 5  * 1024 * 1024;
const MB50 = 50 * 1024 * 1024;
const MB10 = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY)
@Controller('dashboard/entreprise/returns')
export class ReturnsController {

  constructor(
    private readonly returnsService:      ReturnsService,
    private readonly returnsStatsService: ReturnsStatsService,
  ) {}

  /* ── Statistiques globales — AVANT :id ── */
  @Get('stats')
  getStats(@Req() req: any) {
    return this.returnsStatsService.getStats(req.user.id);
  }

  /* ── Liste paginée avec filtres ── */
  @Get()
  findAll(@Req() req: any, @Query() filters: FilterReturnsDto) {
    return this.returnsService.findAll(req.user.id, filters);
  }

  /* ── Détail d'un retour ── */
  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.returnsService.findOne(req.user.id, id);
  }

  /* ── Accepter un retour ── */
  @Patch(':id/accept')
  accept(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptReturnDto,
  ) {
    return this.returnsService.accept(req.user.id, id, dto);
  }

  /* ── Refuser un retour ── */
  @Patch(':id/refuse')
  refuse(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefuseReturnDto,
  ) {
    return this.returnsService.refuse(req.user.id, id, dto);
  }

  /* ── Marquer comme reçu ── */
  @Patch(':id/received')
  markReceived(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.markReceived(req.user.id, id);
  }

  /* ── Rembourser ── */
  @Patch(':id/refund')
  refund(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundReturnDto,
  ) {
    return this.returnsService.refund(req.user.id, id, dto);
  }

  /* ── Ajouter note interne ── */
  @Post(':id/notes')
  addNote(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddReturnNoteDto,
  ) {
    return this.returnsService.addNote(req.user.id, id, dto);
  }

  /* ── Changer priorité ── */
  @Patch(':id/priority')
  updatePriority(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnPriorityDto,
  ) {
    return this.returnsService.updatePriority(req.user.id, id, dto);
  }

  /* ── Upload preuve (image/video/document) ── */
  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEvidence(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('type') type: string,
    @UploadedFile(new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: MB50 }),
        new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)|video\/(mp4|webm)|application\/pdf/ }),
      ],
      fileIsRequired: true,
    })) file: Express.Multer.File,
  ) {
    const evidenceType = type as 'image' | 'video' | 'document';
    if (!['image', 'video', 'document'].includes(evidenceType)) {
      throw new BadRequestException('Type de fichier invalide. Utilisez image, video ou document.');
    }
    return this.returnsService.uploadEvidence(req.user.id, id, file, evidenceType);
  }
}
