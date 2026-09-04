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
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { UserRole } from '../../../../common/enums/user-role.enum';
import { Partner }  from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company }  from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';
import { NotificationEventService } from '../../../notifications/events/notification-event.service';
import { NotificationActorType }    from '../../../../database/entities/notification/notification.entitiy';
import { RedisCacheService }        from '../../../performance-engine/services/redis-cache.service';
import { PlatformSettingsCacheService } from '../../../performance-engine/services/platform-settings-cache.service';
import { initials, relTime, userName, escapeHtml } from '../helpers/admin.helpers';
import { SEV_TO_GRAVITE }    from '../helpers/admin.constants';

/** Report.status (base) → statut affiché côté frontend (voir Sidebar/onglets). */
function mapStatut(status: ReportStatus): 'review' | 'invest' | 'resolved' | 'rejected' {
  if (status === ReportStatus.PENDING)       return 'review';
  if (status === ReportStatus.INVESTIGATING) return 'invest';
  if (status === ReportStatus.REJECTED)      return 'rejected';
  return 'resolved';
}

/** Préfixe de cache pour getSignalements — voir SIGNALEMENTS_CACHE_TTL_SEC.
 * Global (pas par admin) : les signalements ne sont pas zonés, tous les
 * admins voient la même liste (voir note en tête de fichier). Exporté pour
 * que ReportsService (module super-admin) puisse invalider à la création
 * d'un nouveau signalement, sans dupliquer la constante. */
export const SIGNALEMENTS_CACHE_PREFIX = 'admin-signalements:list:';
const SIGNALEMENTS_CACHE_TTL_SEC = 15;

export interface SignalementsListResult {
  list: unknown[];
  stats: { aTraiter: number; enCours: number; traites: number; suspendus: number };
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class AdminSignalementsService {

  constructor(
    private readonly zoneService: AdminZoneService,
    private readonly notifEvents: NotificationEventService,
    private readonly cache:       RedisCacheService,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    /* BUG CORRIGÉ — PlatformSettings.reportsBeforeSuspend (Paramètres
     * Plateforme > Inscriptions) se sauvegardait en base sans jamais être
     * appliqué : aucune logique ne comptait les signalements par compte
     * ni ne suspendait quoi que ce soit — voir warnSignalement() ci-dessous. */
    private readonly settingsCache: PlatformSettingsCacheService,
  ) {}

  /**
   * Résout le profil (profileId + type d'acteur) d'un utilisateur, pour
   * pouvoir lui envoyer une notification (warnSignalement ci-dessous).
   * Pas de vérification de zone ici : les signalements sont une file
   * globale, visible et actionnable par tous les admins (voir note en
   * tête de fichier) — cohérent avec resolveSignalement, déjà sans
   * contrôle de zone.
   */
  private async resolveProfile(
    userId: string,
    role?:  UserRole,
  ): Promise<{ profileId: string; actorType: NotificationActorType } | null> {
    if (role === UserRole.PARTNER) {
      const p = await this.partnerRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return p ? { profileId: p.id, actorType: NotificationActorType.PARTNER } : null;
    }
    if (role === UserRole.COMPANY) {
      const c = await this.companyRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return c ? { profileId: c.id, actorType: NotificationActorType.COMPANY } : null;
    }
    if (role === UserRole.DELIVERY) {
      const d = await this.deliveryRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return d ? { profileId: d.id, actorType: NotificationActorType.DELIVERY } : null;
    }
    return null;
  }

  /**
   * Retourne les 100 derniers signalements (tri anti-chronologique).
   * Inclut les statistiques par statut pour les compteurs frontend.
   *
   * Le champ `type` est hardcodé à 'ent' car le type de cible
   * (par/ent/lvr/cor) n'est pas encore stocké dans Report.
   */
  async getSignalements(userId: string, page = 1, limit = 20) {
    /* Autorisation — vérifie que l'appelant a bien un profil Admin.
     * Ce contrôleur n'a qu'un JwtAuthGuard (pas de RolesGuard global) ;
     * chaque méthode de service doit donc vérifier elle-même l'accès via
     * adminOf(). Cette méthode ne le faisait pas : n'importe quel
     * utilisateur authentifié (client, entreprise, livreur…) pouvait lire
     * l'intégralité des signalements d'abus de la plateforme. */
    await this.zoneService.adminOf(userId);

    const safeLimit = Math.min(limit, 100);
    const cacheKey  = `${SIGNALEMENTS_CACHE_PREFIX}${page}:${safeLimit}`;
    const cached = await this.cache.get<SignalementsListResult>(cacheKey);
    if (cached) return cached;

    const [reports, total, aTraiter, enCours, suspendus] = await Promise.all([
      this.reportRepo.find({
        order: { createdAt: 'DESC' },
        skip: (page - 1) * safeLimit,
        take: safeLimit,
      }),
      this.reportRepo.count(),
      this.reportRepo.count({ where: { status: ReportStatus.PENDING } }),
      this.reportRepo.count({ where: { status: ReportStatus.INVESTIGATING } }),
      /* BUG CORRIGÉ — était codé en dur à 0. Compte les comptes actuellement
       * SUSPENDED ayant au moins un signalement fondé (voir warnSignalement/
       * maybeAutoSuspend) — une suspension manuelle sans signalement fondé
       * associé n'est pas comptée ici, ce widget concerne spécifiquement
       * l'effet des signalements. */
      this.reportRepo
        .createQueryBuilder('r')
        .innerJoin(User, 'u', 'u.id = r.targetUserId')
        .where('r.founded = true')
        .andWhere('u.status = :status', { status: UserStatus.SUSPENDED })
        .select('COUNT(DISTINCT r.targetUserId)', 'count')
        .getRawOne<{ count: string }>()
        .then(r => Number(r?.count ?? 0)),
    ]);

    const list = reports.map(r => ({
      id:           r.id,
      cible:        r.title,
      avatar:       initials(r.title),
      targetUserId: r.targetUserId, // null si le signalement ne vise pas un compte identifié
      type:       'ent',
      gravite:    SEV_TO_GRAVITE[r.severity],
      motifLabel: r.severity === ReportSeverity.CRITICAL ? 'Critique'
                : r.severity === ReportSeverity.WARNING   ? 'Avertissement'
                : 'Info',
      raison:     r.description ?? '',
      signalePar: r.reporterId
                  ? `Utilisateur #${r.reporterId.slice(0, 8)}`
                  : 'Système',
      statut:     mapStatut(r.status),
      quand:      relTime(r.createdAt),
    }));

    const out: SignalementsListResult = {
      list,
      stats: {
        aTraiter,
        enCours,
        traites:   total - aTraiter - enCours,
        suspendus,
      },
      page, limit: safeLimit, total,
    };
    await this.cache.set(cacheKey, out, SIGNALEMENTS_CACHE_TTL_SEC);
    return out;
  }

  /**
   * Retourne UN signalement précis par son ID, dans le même format que
   * `list` ci-dessus — utilisé pour le deep-link "clic sur une notification"
   * (la pagination/l'onglet actif de la liste ne garantit pas que l'élément
   * visé soit déjà chargé côté frontend).
   */
  async getSignalementById(userId: string, id: string) {
    await this.zoneService.adminOf(userId);

    const r = await this.reportRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Signalement introuvable.');

    return {
      id:           r.id,
      cible:        r.title,
      avatar:       initials(r.title),
      targetUserId: r.targetUserId, // null si le signalement ne vise pas un compte identifié
      type:       'ent',
      gravite:    SEV_TO_GRAVITE[r.severity],
      motifLabel: r.severity === ReportSeverity.CRITICAL ? 'Critique'
                : r.severity === ReportSeverity.WARNING   ? 'Avertissement'
                : 'Info',
      raison:     r.description ?? '',
      signalePar: r.reporterId
                  ? `Utilisateur #${r.reporterId.slice(0, 8)}`
                  : 'Système',
      statut:     mapStatut(r.status),
      quand:      relTime(r.createdAt),
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
    await this.cache.delByPattern(SIGNALEMENTS_CACHE_PREFIX);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '✅',
      action:     `a résolu le signalement « ${escapeHtml(report.title)} »`,
      targetType: 'report',
      targetId:   report.id,
    }));

    return { message: 'Signalement résolu.' };
  }

  /**
   * Ouvre une enquête sur un signalement (PENDING → INVESTIGATING).
   * Purement un changement de statut interne — ne nécessite pas de compte
   * cible identifié, contrairement à warnSignalement ci-dessous.
   */
  async investigateSignalement(adminUserId: string, id: string) {
    const admin  = await this.zoneService.adminOf(adminUserId);
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable.');

    if (report.status === ReportStatus.RESOLVED) {
      throw new BadRequestException('Ce signalement est déjà résolu.');
    }
    if (report.status === ReportStatus.INVESTIGATING) {
      throw new BadRequestException('Une enquête est déjà en cours sur ce signalement.');
    }

    report.status = ReportStatus.INVESTIGATING;
    await this.reportRepo.save(report);
    await this.cache.delByPattern(SIGNALEMENTS_CACHE_PREFIX);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '🔍',
      action:     `a ouvert une enquête sur le signalement « ${escapeHtml(report.title)} »`,
      targetType: 'report',
      targetId:   report.id,
    }));

    return { message: 'Enquête ouverte.' };
  }

  /**
   * Envoie un avertissement au compte visé par le signalement — sans le
   * suspendre. Nécessite un `targetUserId` renseigné sur le signalement :
   * un signalement créé avec juste un nom libre (pas encore de sélecteur
   * de compte réel côté ReportModal) ne peut pas être ciblé ici.
   */
  async warnSignalement(adminUserId: string, id: string) {
    const admin  = await this.zoneService.adminOf(adminUserId);
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable.');

    if (!report.targetUserId) {
      throw new BadRequestException("Ce signalement ne référence pas de compte identifié — impossible d'avertir.");
    }

    const user = await this.userRepo.findOne({ where: { id: report.targetUserId } });
    if (!user) throw new NotFoundException('Compte visé introuvable.');

    const profile = await this.resolveProfile(report.targetUserId, user.role);
    if (!profile) throw new NotFoundException('Profil du compte visé introuvable.');

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '⚠️',
      action:     `a averti <b>${escapeHtml(userName(user))}</b> suite au signalement « ${escapeHtml(report.title)} »`,
      targetType: 'user',
      targetId:   report.targetUserId,
    }));

    await this.notifEvents.notifyActeurAccountWarned({
      recipientType: profile.actorType,
      recipientId:   profile.profileId,
      motif:         report.title,
    });

    /* Marque CE signalement comme fondé — seul un avertissement (l'admin
     * confirme explicitement une faute) compte pour le seuil d'auto-
     * suspension, contrairement à resolveSignalement() (classement sans
     * jugement sur le fond) ou investigateSignalement(). */
    report.founded      = true;
    report.foundedAt     = new Date();
    report.status        = ReportStatus.RESOLVED;
    report.resolvedAt    = report.resolvedAt ?? new Date();
    report.resolvedById  = report.resolvedById ?? adminUserId;
    await this.reportRepo.save(report);
    await this.cache.delByPattern(SIGNALEMENTS_CACHE_PREFIX);

    await this.maybeAutoSuspend(admin.id, user, report.targetUserId);

    return { message: 'Avertissement envoyé.' };
  }

  /**
   * Rejette un signalement : classé sans suite, jugé infondé — distinct
   * de resolveSignalement() (qui reste utilisé pour "traité d'une autre
   * façon"). N'affecte jamais `founded` (déjà false par défaut) ni le
   * compte visé : rejeter un signalement ne doit jamais compter pour le
   * seuil d'auto-suspension (voir warnSignalement/maybeAutoSuspend), au
   * contraire — c'est précisément le mécanisme qui protège contre les
   * faux signalements en masse.
   */
  async rejectSignalement(adminUserId: string, id: string, reason?: string) {
    const admin  = await this.zoneService.adminOf(adminUserId);
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Signalement introuvable.');

    if (report.status === ReportStatus.RESOLVED || report.status === ReportStatus.REJECTED) {
      throw new BadRequestException('Ce signalement a déjà été traité.');
    }

    report.status          = ReportStatus.REJECTED;
    report.resolvedAt      = new Date();
    report.resolvedById    = adminUserId;
    report.rejectionReason = reason?.trim().slice(0, 500) || null;
    await this.reportRepo.save(report);
    await this.cache.delByPattern(SIGNALEMENTS_CACHE_PREFIX);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '🗑️',
      action:     `a rejeté le signalement « ${escapeHtml(report.title)} »${reason ? ` — ${escapeHtml(reason)}` : ''}`,
      targetType: 'report',
      targetId:   report.id,
    }));

    return { message: 'Signalement rejeté.' };
  }

  /**
   * Suspend automatiquement un compte dès que son nombre de signalements
   * FONDÉS (founded=true) atteint PlatformSettings.reportsBeforeSuspend.
   * Appelé après chaque warnSignalement() — le seuil ne peut donc jamais
   * être franchi par de simples signalements non confirmés.
   */
  private async maybeAutoSuspend(adminProfileId: string, user: User, targetUserId: string): Promise<void> {
    if (user.status !== UserStatus.ACTIVE) return; // déjà suspendu/banni — rien à refaire

    const { reportsBeforeSuspend } = await this.settingsCache.getSettings();
    if (!reportsBeforeSuspend || reportsBeforeSuspend <= 0) return;

    const foundedCount = await this.reportRepo.count({
      where: { targetUserId, founded: true },
    });
    if (foundedCount < reportsBeforeSuspend) return;

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);
    /* Même clés que AdminActeursService.invalidateActeursCache — les deux
     * dashboards (Acteurs et Signalements) lisent le même User.status. */
    await Promise.all([
      this.cache.del(`admin-acteurs-raw:${adminProfileId}`),
      this.cache.del(`admin-partenaires-raw:${adminProfileId}`),
    ]);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    null,
      actorName:  'Système',
      icon:       '🚫',
      action:     `a suspendu automatiquement le compte de <b>${escapeHtml(userName(user))}</b> — ${foundedCount} signalements fondés (seuil : ${reportsBeforeSuspend})`,
      targetType: 'user',
      targetId:   targetUserId,
    }));

    const profile = await this.resolveProfile(targetUserId, user.role);
    if (profile) {
      await this.notifEvents.notifyActeurAccountSuspended({
        recipientType: profile.actorType,
        recipientId:   profile.profileId,
        motif:         `${foundedCount} signalements confirmés par l'administration.`,
      });
    }

    await this.notifEvents.notifyAdminAlert({
      recipientType: NotificationActorType.ADMIN,
      recipientId:   adminProfileId,
      severity:      'WARNING',
      alertType:     'auto_suspension',
      title:         'Compte auto-suspendu 🚫',
      body:          `${userName(user)} a été automatiquement suspendu(e) après ${foundedCount} signalements fondés.`,
      metadata:      { userId: targetUserId, foundedCount },
    });
  }

}
