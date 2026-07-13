import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard }    from '../../../../common/guards/auth.guard';
import { ReportsService }  from '../services/reports.service';
import { CreateReportDto } from '../dto/create-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class ReportsController {

  constructor(private readonly reportsService: ReportsService) {}

  /* 5 signalements maximum par heure par utilisateur */
  @Post()
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  async create(@Body() dto: CreateReportDto, @Request() req: any) {
    return this.reportsService.create(req.user, dto);
  }
}
