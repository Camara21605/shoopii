/* ============================================================
 * SERVICE : admin-acteurs.service.ts
 *
 * Gestion des acteurs de la zone et des validations de comptes.
 *
 * Acteurs : liste filtrée par rôle (par/ent/lvr) avec recherche
 *           textuelle par nom ou email.
 *
 * Validations : liste des comptes PENDING + approbation/refus
 *               avec journalisation dans AuditLog.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { NotificationEventService } from '../../../../modules/notifications/events/notification-event.service';
import { NotificationActorType }    from '../../../../database/entities/notification/notification.entitiy';

import { Partner }  from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company }  from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../../../database/entities/profiles/livreur-profile.entity';
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { UserRole }         from '../../../../common/enums/user-role.enum';
import { AuditLog }         from '../../../../database/entities/audit-log.entity';

import { initials, userName, mapSt, relTime } from '../helpers/admin.helpers';

@Injectable()
export class AdminActeursService {

  constructor(
    private readonly zoneService:    AdminZoneService,
    private readonly notifEvents:    NotificationEventService,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  // ─────────────────────────────────────────────────────────
  // HELPER PRIVÉ
  // ─────────────────────────────────────────────────────────

  /**
   * Résout le profileId et le type d'acteur d'un utilisateur.
   * Retourne null si le profil n'existe pas encore en base.
   *
   * Si le rôle est déjà connu de l'appelant (cas de approve/reject
   * Validation, qui a déjà chargé le User), une seule requête ciblée
   * suffit au lieu de sonder les 3 tables de profil en parallèle.
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

    // Rôle inconnu/absent — repli sur les 3 requêtes parallèles.
    const [partner, company, delivery] = await Promise.all([
      this.partnerRepo.findOne({ where: { user: { id: userId } } }).catch(() => null),
      this.companyRepo.findOne({ where: { user: { id: userId } } }).catch(() => null),
      this.deliveryRepo.findOne({ where: { user: { id: userId } } }).catch(() => null),
    ]);
    if (partner)  return { profileId: partner.id,  actorType: NotificationActorType.PARTNER };
    if (company)  return { profileId: company.id,  actorType: NotificationActorType.COMPANY };
    if (delivery) return { profileId: delivery.id, actorType: NotificationActorType.DELIVERY };
    return null;
  }

  // ════════════════════════════════════════════════════════════
  // LISTE DES ACTEURS
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne la liste des acteurs de la zone.
   *
   * Filtrage :
   *   • roleFilter : 'par' | 'ent' | 'lvr' (tous si absent)
   *   • search     : filtre textuel sur nom et email (insensible à la casse)
   *
   * Note : les correspondants ne sont pas encore inclus car le champ FK
   * (livreurId ou deliveryId) n'est pas stabilisé dans le schéma.
   */
  async getActeurs(userId: string, roleFilter?: string, search?: string, page = 1, limit = 20) {
    const admin  = await this.zoneService.adminOf(userId);
    const result: any[] = [];
    const q = search?.toLowerCase();

    /**
     * Ajoute les acteurs formatés dans result après filtrage textuel.
     * Le filtre porte sur nom + email pour couvrir les deux cas d'usage.
     */
    const push = (items: any[]) => {
      for (const item of items) {
        if (q && !item.nom.toLowerCase().includes(q) && !(item.email ?? '').toLowerCase().includes(q)) continue;
        result.push(item);
      }
    };

    // ── Partenaires ──────────────────────────────────────────
    if (!roleFilter || roleFilter === 'par') {
      const partners = await this.partnerRepo.find({
        where: { adminId: admin.id }, relations: ['user'], take: 200,
      });
      push(
        partners.filter(p => p.user).map(p => {
          const nom = userName(p.user);
          return {
            id:         p.user.id,
            type:       'par',
            nom,
            email:      p.user.email,
            // phone peut être sur le profil Partner ou sur User selon la migration
            telephone:  (p as any).phone ?? p.user.phone ?? '—',
            commune:    (p as any).commune ?? '—',
            recrutePar: admin.fullName,
            activite:   'Partenaire',
            statut:     mapSt(p.user.status),
            avatar:     initials(nom),
          };
        }),
      );
    }

    // ── Entreprises ──────────────────────────────────────────
    if (!roleFilter || roleFilter === 'ent') {
      const companies = await this.companyRepo.find({
        where: { adminId: admin.id }, relations: ['user'], take: 200,
      });
      push(
        companies.filter(c => c.user).map(c => {
          const nom = userName(c.user);
          return {
            id:         c.user.id,
            type:       'ent',
            nom,
            email:      c.user.email,
            telephone:  c.user.phone ?? '—',
            commune:    (c as any).commune ?? '—',
            recrutePar: admin.fullName,
            activite:   'Entreprise',
            statut:     mapSt(c.user.status),
            avatar:     initials(nom),
          };
        }),
      );
    }

    // ── Livreurs ─────────────────────────────────────────────
    if (!roleFilter || roleFilter === 'lvr') {
      const deliveries = await this.deliveryRepo.find({
        where: { adminId: admin.id }, relations: ['user'], take: 200,
      });
      push(
        deliveries.filter(d => d.user).map(d => {
          const nom = userName(d.user);
          return {
            id:         d.user.id,
            type:       'lvr',
            nom,
            email:      d.user.email,
            telephone:  d.user.phone ?? '—',
            commune:    '—',
            recrutePar: admin.fullName,
            activite:   'Livreur',
            statut:     mapSt(d.user.status),
            avatar:     initials(nom),
          };
        }),
      );
    }

    const counts = {
      all: result.length,
      par: result.filter(a => a.type === 'par').length,
      ent: result.filter(a => a.type === 'ent').length,
      lvr: result.filter(a => a.type === 'lvr').length,
      cor: 0, // correspondants non encore intégrés
    };

    // Pagination appliquée après filtrage (recherche + type) — bornée
    // par les take:200 par type ci-dessus (max 600 lignes en mémoire,
    // jamais 600 renvoyées au frontend).
    const safeLimit = Math.min(limit, 100);
    const start = (page - 1) * safeLimit;
    const list  = result.slice(start, start + safeLimit);

    return { list, counts, page, limit: safeLimit, total: result.length };
  }

  // ════════════════════════════════════════════════════════════
  // VALIDATIONS DE COMPTES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne tous les comptes en attente de validation dans la zone
   * (partenaires, entreprises, livreurs dont user.status = PENDING).
   *
   * Filtre PENDING appliqué directement en SQL (jointure sur user +
   * condition), au lieu de récupérer TOUS les acteurs de la zone pour
   * ensuite ne garder que les PENDING en mémoire.
   */
  async getValidations(userId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const items: any[] = [];

    const pendingWhere = (adminId: string) => ({
      adminId, user: { status: UserStatus.PENDING },
    });

    const [partners, companies, deliveries] = await Promise.all([
      this.partnerRepo.find({ where: pendingWhere(admin.id), relations: ['user'], take: 200 }),
      this.companyRepo.find({ where: pendingWhere(admin.id), relations: ['user'], take: 200 }),
      this.deliveryRepo.find({ where: pendingWhere(admin.id), relations: ['user'], take: 200 }),
    ]);

    for (const p of partners) {
      const nom = userName(p.user);
      items.push({
        id: p.user.id, nom, avatar: initials(nom), type: 'par',
        description: `Inscription partenaire — zone ${admin.zone ?? ''}`,
        commune:     (p as any).commune ?? '—',
        quand:       relTime(p.user.createdAt),
        recrutePar:  admin.fullName,
      });
    }

    for (const c of companies) {
      const nom = userName(c.user);
      items.push({
        id: c.user.id, nom, avatar: initials(nom), type: 'ent',
        description: 'Inscription entreprise — documents à vérifier',
        commune:     (c as any).commune ?? '—',
        quand:       relTime(c.user.createdAt),
        recrutePar:  admin.fullName,
      });
    }

    for (const d of deliveries) {
      const nom = userName(d.user);
      items.push({
        id: d.user.id, nom, avatar: initials(nom), type: 'lvr',
        description: 'Inscription livreur — CNI + permis à vérifier',
        commune:     '—',
        quand:       relTime(d.user.createdAt),
        recrutePar:  admin.fullName,
      });
    }

    return {
      list:  items,
      stats: { pending: items.length, validatedMois: 0, refusedMois: 0 },
    };
  }

  /**
   * Approuve un compte PENDING : status → ACTIVE.
   * L'action est journalisée dans AuditLog et une notification
   * est envoyée à l'acteur concerné (in-app + push si activé).
   */
  async approveValidation(adminUserId: string, targetUserId: string) {
    const admin = await this.zoneService.adminOf(adminUserId);
    const user  = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '✅',
      action:     `a validé le compte de <b>${userName(user)}</b>`,
      targetType: 'user',
      targetId:   targetUserId,
    }));

    // Notification asynchrone (fire-and-forget) à l'acteur validé
    this.resolveProfile(targetUserId, user.role).then(profile => {
      if (!profile) return;
      this.notifEvents.notifyActeurAccountApproved({
        recipientType: profile.actorType,
        recipientId:   profile.profileId,
        acteurNom:     userName(user),
      });
    }).catch(() => {});

    return { message: 'Compte validé.' };
  }

  /**
   * Refuse un compte PENDING : status → SUSPENDED.
   * L'action est journalisée dans AuditLog et une notification
   * est envoyée à l'acteur concerné pour l'informer du refus.
   */
  async rejectValidation(adminUserId: string, targetUserId: string) {
    const admin = await this.zoneService.adminOf(adminUserId);
    const user  = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '❌',
      action:     `a refusé le compte de <b>${userName(user)}</b>`,
      targetType: 'user',
      targetId:   targetUserId,
    }));

    // Notification asynchrone (fire-and-forget) à l'acteur refusé
    this.resolveProfile(targetUserId, user.role).then(profile => {
      if (!profile) return;
      this.notifEvents.notifyActeurAccountRejected({
        recipientType: profile.actorType,
        recipientId:   profile.profileId,
      });
    }).catch(() => {});

    return { message: 'Compte refusé.' };
  }
}
