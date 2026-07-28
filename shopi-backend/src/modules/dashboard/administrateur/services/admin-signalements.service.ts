/* ============================================================
 * SERVICE : admin-signalements.service.ts
 *
 * Lecture et résolution des signalements (reports).
 *
 * Limitation actuelle : les signalements ne sont pas encore
 * filtrés par zone admin (la table Report n'a pas de colonne
 * adminId).  Tous les signalements PENDING sont donc visibles
 * par tous les admins.  À corriger quand la FK sera ajoutée.
 * ============================================================ */

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import {
  Report,
  ReportStatus,
  ReportSeverity,
} from '../../../../database/entities/report.entity';
import { AuditLog }      from '../../../../database/entities/audit-log.entity';
import { initials, relTime } from '../helpers/admin.helpers';
import { SEV_TO_GRAVITE }    from '../helpers/admin.constants';

@Injectable()
export class AdminSignalementsService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Retourne les 100 derniers signalements (tri anti-chronologique).
   * Inclut les statistiques par statut pour les compteurs frontend.
   *
   * Le champ `type` est hardcodé à 'ent' car le type de cible
   * (par/ent/lvr/cor) n'est pas encore stocké dans Report.
   */
  async getSignalements(_userId: string) {
    const reports = await this.reportRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });

    const list = reports.map(r => ({
      id:         r.id,
      cible:      r.title,
      avatar:     initials(r.title),
      type:       'ent',
      gravite:    SEV_TO_GRAVITE[r.severity],
      motifLabel: r.severity === ReportSeverity.CRITICAL ? 'Critique'
                : r.severity === ReportSeverity.WARNING   ? 'Avertissement'
                : 'Info',
      raison:     r.description ?? '',
      signalePar: r.reporterId
                  ? `Utilisateur #${r.reporterId.slice(0, 8)}`
                  : 'Système',
      statut:     r.status === ReportStatus.PENDING ? 'review' : 'resolved',
      quand:      relTime(r.createdAt),
    }));

    return {
      list,
      stats: {
        aTraiter:  list.filter(s => s.statut === 'review').length,
        enCours:   0,   // pas de statut intermédiaire 'invest' en base pour l'instant
        traites:   list.filter(s => s.statut === 'resolved').length,
        suspendus: 0,
      },
    };
  }

  /**
   * Marque un signalement comme résolu (PENDING → RESOLVED).
   *
   * Garde-fous :
   *   • Lève NotFoundException si l'ID est inexistant.
   *   • Lève BadRequestException si déjà résolu (idempotence).
   *
   * L'action est journalisée dans AuditLog.
   */
  async resolveSignalement(adminUserId: string, id: string) {
    const admin  = await this.zoneService.adminOf(adminUserId);
    const report = await this.reportRepo.findOne({ where: { id } });

    if (!report)  throw new NotFoundException('Signalement introuvable.');
    if (report.status === ReportStatus.RESOLVED) {
      throw new BadRequestException('Ce signalement est déjà résolu.');
    }

    report.status       = ReportStatus.RESOLVED;
    report.resolvedAt   = new Date();
    report.resolvedById = adminUserId;
    await this.reportRepo.save(report);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '✅',
      action:     `a résolu le signalement « ${report.title} »`,
      targetType: 'report',
      targetId:   report.id,
    }));

    return { message: 'Signalement résolu.' };
  }
}
