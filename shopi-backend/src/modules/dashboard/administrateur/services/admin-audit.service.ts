/* ============================================================
 * SERVICE : admin-audit.service.ts
 *
 * Lecture du journal d'audit de l'administrateur.
 *
 * Retourne les 200 dernières actions de l'admin (ses propres
 * actions uniquement, filtrées par actorId = userId).
 *
 * Le filtrage par catégorie (ok / ban / code / warn) est appliqué
 * côté frontend pour éviter des allers-retours supplémentaires.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AuditLog }             from '../../../../database/entities/audit-log.entity';
import { iconKind, relTime }    from '../helpers/admin.helpers';

@Injectable()
export class AdminAuditService {

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Retourne le journal d'audit de l'admin :
   *   • 200 dernières entrées, triées par date décroissante
   *   • Chaque entrée est enrichie avec :
   *       – kind   : catégorie visuelle (code / ok / warn / ban)
   *       – quand  : libellé de temps relatif ("Il y a 3h")
   *       – id     : identifiant lisible "AUD-XXXXXXXX"
   */
  async getAudit(userId: string, page = 1, limit = 20) {
    const safeLimit = Math.min(limit, 100);

    const [logs, total] = await Promise.all([
      this.auditLogRepo.find({
        where: { actorId: userId },
        order: { createdAt: 'DESC' },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
      }),
      this.auditLogRepo.count({ where: { actorId: userId } }),
    ]);

    const list = logs.map(a => ({
      id:     `AUD-${a.id.slice(0, 8).toUpperCase()}`,
      kind:   iconKind(a.icon, a.action),
      texte:  a.action,
      auteur: a.actorName,
      quand:  relTime(a.createdAt),
    }));

    return { list, page, limit: safeLimit, total };
  }
}
