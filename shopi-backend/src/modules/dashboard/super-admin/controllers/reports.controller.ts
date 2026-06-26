/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/controllers/reports.controller.ts
 *
 * Permet à tout utilisateur authentifié de signaler un compte
 * ou un comportement suspect. Le signalement alimente la file
 * de modération du super-admin (section "Signalements").
 * ============================================================ */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../common/guards/auth.guard';
import { ReportsService } from '../services/reports.service';
import { ReportSeverity } from '../../../../database/entities/report.entity';

interface CreateReportBody {
  title:         string;
  description?:  string;
  severity?:     ReportSeverity;
  targetUserId?: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {

  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  async create(@Body() body: CreateReportBody, @Request() req: any) {
    return this.reportsService.create(req.user, body);
  }
}
