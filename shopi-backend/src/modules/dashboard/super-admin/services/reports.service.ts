/* ============================================================
 * FICHIER : src/modules/dashboard/super-admin/services/reports.service.ts
 *
 * Signalements (alertes) — file de modération traitée par le
 * super-admin / admin dans la section "Signalements".
 * ============================================================ */

import {
  BadRequestException, ForbiddenException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportSeverity, ReportStatus } from '../../../../database/entities/report.entity';
import { User } from '../../../../database/entities/user.entity';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { AuditLogService } from './audit-log.service';

export interface AlertDto {
  id:       string;
  type:     ReportSeverity;
  icon:     string;
  title:    string;
  sub:      string;
  time:     string;
  resolved: boolean;
}

const SEVERITY_ICON: Record<ReportSeverity, string> = {
  [ReportSeverity.CRITICAL]: '🔴',
  [ReportSeverity.WARNING]:  '🟡',
  [ReportSeverity.INFO]:     '🔵',
};

@Injectable()
export class ReportsService {

  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    private readonly auditLog: AuditLogService,
  ) {}

  private assertIsAdminOrSuperAdmin(caller: User): void {
    if (caller.role !== UserRole.ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Accès réservé aux administrateurs.');
    }
  }

  /* ── Liste des signalements (super-admin) ── */
  async list(caller: User): Promise<AlertDto[]> {
    this.assertIsAdminOrSuperAdmin(caller);

    const reports = await this.reportRepo.find({
      order: { createdAt: 'DESC' },
      take:  100,
    });

    return reports.map(r => this.toAlertDto(r));
  }

  /* ── Création d'un signalement (tout utilisateur authentifié) ── */
  async create(
    reporter: User,
    dto: { title: string; description?: string; severity?: ReportSeverity; targetUserId?: string },
  ): Promise<AlertDto> {
    if (!dto.title?.trim()) {
      throw new BadRequestException('Le titre du signalement est obligatoire.');
    }

    const report = this.reportRepo.create({
      title:        dto.title.trim(),
      description:  dto.description?.trim() || null,
      severity:     dto.severity ?? ReportSeverity.WARNING,
      reporterId:   reporter.id,
      targetUserId: dto.targetUserId ?? null,
      status:       ReportStatus.PENDING,
    });
    const saved = await this.reportRepo.save(report);

    return this.toAlertDto(saved);
  }

  /* ── Résoudre un signalement (super-admin) ── */
  async resolve(id: string, caller: User): Promise<{ message: string }> {
    this.assertIsAdminOrSuperAdmin(caller);

    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable.');

    if (report.status === ReportStatus.RESOLVED) {
      throw new BadRequestException('Ce signalement est déjà résolu.');
    }

    report.status     = ReportStatus.RESOLVED;
    report.resolvedAt = new Date();
    report.resolvedById = caller.id;
    await this.reportRepo.save(report);

    await this.auditLog.log(
      caller, '✅',
      `a résolu le signalement « ${report.title} »`,
      { type: 'report', id: report.id },
    );

    return { message: 'Signalement résolu.' };
  }

  /* ── Helpers ── */
  private toAlertDto(r: Report): AlertDto {
    return {
      id:       r.id,
      type:     r.severity,
      icon:     SEVERITY_ICON[r.severity],
      title:    r.title,
      sub:      r.description ?? '',
      time:     this.relativeTime(r.createdAt),
      resolved: r.status === ReportStatus.RESOLVED,
    };
  }

  private relativeTime(date: Date): string {
    const diffMs  = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1)  return "À l'instant";
    if (minutes < 60) return `Il y a ${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  }
}
