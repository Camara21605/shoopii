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

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { Repository }                    from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { NotificationEventService } from '../../../../modules/notifications/events/notification-event.service';
import { NotificationActorType }    from '../../../../database/entities/notification/notification.entitiy';
import { RedisCacheService }        from '../../../performance-engine/services/redis-cache.service';

import { Partner }  from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company, VerificationStatus as CompanyVerificationStatus } from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery, LivreurVerificationStatus } from '../../../../database/entities/profiles/livreur-profile.entity';
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { UserRole }         from '../../../../common/enums/user-role.enum';
import { AuditLog }         from '../../../../database/entities/audit-log.entity';
import { Admin }            from '../../../../database/entities/profiles/admin-profile.entity';
import { PlatformSettingsCacheService } from '../../../performance-engine/services/platform-settings-cache.service';

import { initials, userName, mapSt, relTime, escapeHtml } from '../helpers/admin.helpers';

/** TTL du cache "acteurs bruts" — courte durée : ce sont des pages de
 * modération où l'admin agit puis regarde le résultat, une donnée
 * périmée plus de quelques secondes serait trompeuse. Invalidé
 * activement sur chaque écriture (voir invalidateActeursCache). */
const ACTEURS_CACHE_TTL_SEC = 20;

@Injectable()
export class AdminActeursService {

  constructor(
    private readonly zoneService:    AdminZoneService,
    private readonly notifEvents:    NotificationEventService,
    private readonly cache:          RedisCacheService,

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

    /* BUG CORRIGÉ — PlatformSettings.kycRequired (Paramètres Plateforme >
     * Inscriptions) se sauvegardait en base sans jamais être appliqué :
     * approveValidation() activait n'importe quel compte, documents
     * d'identité soumis ou non. Le modèle de données KYC (ownerIdDocument,
     * documentCni, verificationStatus…) existait déjà par ailleurs — voir
     * documents-parametres.service.ts / profil-livreur.service.ts — mais
     * rien n'exploitait jamais REVIEWING → VERIFIED côté admin : cette
     * étape manquante est ajoutée ici, fusionnée avec l'approbation du
     * compte plutôt qu'un second bouton séparé. */
    private readonly settingsCache: PlatformSettingsCacheService,
  ) {}

  /**
   * Invalide le cache "acteurs bruts" de CE service, ainsi que celui
   * d'AdminPartenairesService (clé `admin-partenaires-raw:${adminId}`,
   * volontairement dupliquée en dur ici plutôt qu'un événement/bus —
   * les deux services lisent le même statut User.status, un partenaire
   * suspendu ici doit se refléter immédiatement dans les deux listes).
   */
  private async invalidateActeursCache(adminId: string): Promise<void> {
    await Promise.all([
      this.cache.del(`admin-acteurs-raw:${adminId}`),
      this.cache.del(`admin-partenaires-raw:${adminId}`),
    ]);
  }

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

  /**
   * Notifie le partenaire recruteur (Partner.partnerId sur Company/Delivery)
   * qu'un acteur qu'il a recruté vient d'être activé — voir
   * notifyPartnerActeurActivated(). Fire-and-forget, ne doit jamais faire
   * échouer approveValidation() si la résolution du partenaire échoue.
   */
  private async notifyRecruitingPartner(
    userId: string,
    role:   UserRole,
    acteurNom: string,
  ): Promise<void> {
    try {
      let partnerId: string | null = null;

      if (role === UserRole.COMPANY) {
        const c = await this.companyRepo.findOne({ where: { user: { id: userId } } });
        partnerId = c?.partnerId ?? null;
      } else if (role === UserRole.DELIVERY) {
        const d = await this.deliveryRepo.findOne({ where: { user: { id: userId } } });
        partnerId = d?.partnerId ?? null;
      }
      if (!partnerId) return;

      await this.notifEvents.notifyPartnerActeurActivated({
        recipientId: partnerId,
        acteurNom,
        acteurType: role === UserRole.COMPANY ? 'entreprise' : 'livreur',
      });
    } catch {
      /* jamais bloquant */
    }
  }

  // ════════════════════════════════════════════════════════════
  // LISTE DES ACTEURS
  // ════════════════════════════════════════════════════════════

  /**
   * Charge les 3 types d'acteurs de la zone (bruts, sans filtre recherche/
   * rôle/pagination) — mis en cache court car c'est la partie coûteuse
   * (3 requêtes DB + jointure `user`, jusqu'à 600 lignes). Toujours les
   * 3 types ensemble (même si un seul rôle est demandé côté frontend) :
   * un seul cache sert alors TOUTES les combinaisons de filtre/recherche/
   * page, plutôt qu'une entrée par combinaison.
   */
  private async loadActeursBruts(admin: Admin): Promise<any[]> {
    const cacheKey = `admin-acteurs-raw:${admin.id}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const [partners, companies, deliveries] = await Promise.all([
      this.partnerRepo.find({ where: { adminId: admin.id }, relations: ['user'], take: 200 }),
      this.companyRepo.find({ where: { adminId: admin.id }, relations: ['user'], take: 200 }),
      this.deliveryRepo.find({ where: { adminId: admin.id }, relations: ['user'], take: 200 }),
    ]);

    const result: any[] = [
      ...partners.filter(p => p.user).map(p => {
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
      ...companies.filter(c => c.user).map(c => {
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
      ...deliveries.filter(d => d.user).map(d => {
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
    ];

    await this.cache.set(cacheKey, result, ACTEURS_CACHE_TTL_SEC);
    return result;
  }

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
    const admin = await this.zoneService.adminOf(userId);
    const brut  = await this.loadActeursBruts(admin);

    const q = search?.toLowerCase();
    const searched = q
      ? brut.filter(a => a.nom.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
      : brut;

    const counts = {
      all: searched.length,
      par: searched.filter(a => a.type === 'par').length,
      ent: searched.filter(a => a.type === 'ent').length,
      lvr: searched.filter(a => a.type === 'lvr').length,
      cor: 0, // correspondants non encore intégrés
    };

    const result = roleFilter ? searched.filter(a => a.type === roleFilter) : searched;

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
   * Vérifie PlatformSettings.kycRequired avant d'autoriser l'activation
   * d'un compte COMPANY/DELIVERY. Scope volontairement limité à ces deux
   * rôles : ce sont les seuls à avoir un modèle de documents KYC existant
   * (ownerIdDocument/documentCni + verificationStatus) — PARTNER n'a
   * aucun champ document, et les comptes CORRESPONDENT sont approuvés par
   * l'entreprise/livreur invitant, pas par cet écran admin régional.
   *
   * Si les documents minimaux sont présents, cette même action les marque
   * VERIFIED — pas de second bouton séparé : l'admin voit déjà "CNI à
   * vérifier" dans la liste des comptes en attente avant de cliquer
   * Approuver (voir listValidations()).
   */
  private async enforceKycBeforeApproval(user: User): Promise<void> {
    const { kycRequired } = await this.settingsCache.getSettings();
    if (!kycRequired) return;

    if (user.role === UserRole.COMPANY) {
      const company = await this.companyRepo.findOne({ where: { userId: user.id } });
      if (!company) return; // profil pas encore créé — rien à vérifier ici
      if (!company.ownerIdDocument) {
        throw new BadRequestException(
          "Ce compte n'a pas encore soumis sa pièce d'identité — impossible de l'activer tant que le KYC n'est pas complété.",
        );
      }
      if (company.verificationStatus !== CompanyVerificationStatus.VERIFIED) {
        company.verificationStatus = CompanyVerificationStatus.VERIFIED;
        await this.companyRepo.save(company);
      }
      return;
    }

    if (user.role === UserRole.DELIVERY) {
      const delivery = await this.deliveryRepo.findOne({ where: { userId: user.id } });
      if (!delivery) return;
      if (!delivery.documentCni) {
        throw new BadRequestException(
          "Ce compte n'a pas encore soumis sa pièce d'identité — impossible de l'activer tant que le KYC n'est pas complété.",
        );
      }
      if (delivery.verificationStatus !== LivreurVerificationStatus.VERIFIED) {
        delivery.verificationStatus = LivreurVerificationStatus.VERIFIED;
        await this.deliveryRepo.save(delivery);
      }
    }
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

    await this.enforceKycBeforeApproval(user);

    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);
    await this.invalidateActeursCache(admin.id);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '✅',
      action:     `a validé le compte de <b>${escapeHtml(userName(user))}</b>`,
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

    // Notification asynchrone au partenaire recruteur (s'il existe) — voir
    // Partenaire > Paramètres > Notifications > "Nouvel acteur activé",
    // catégorie qui n'avait jusqu'ici aucun déclencheur nulle part.
    void this.notifyRecruitingPartner(targetUserId, user.role, userName(user));

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
    await this.invalidateActeursCache(admin.id);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '❌',
      action:     `a refusé le compte de <b>${escapeHtml(userName(user))}</b>`,
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

  // ════════════════════════════════════════════════════════════
  // SUSPENSION D'UN ACTEUR ACTIF
  // ════════════════════════════════════════════════════════════

  /**
   * Résout le profil ET l'adminId de zone d'un utilisateur en une seule
   * requête ciblée — utilisé pour vérifier qu'un acteur appartient bien
   * à la zone de l'admin appelant avant d'autoriser une action dessus.
   */
  private async resolveProfileWithZone(
    userId: string,
    role?:  UserRole,
  ): Promise<{ profileId: string; actorType: NotificationActorType; adminId: string | null } | null> {
    if (role === UserRole.PARTNER) {
      const p = await this.partnerRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return p ? { profileId: p.id, actorType: NotificationActorType.PARTNER, adminId: p.adminId } : null;
    }
    if (role === UserRole.COMPANY) {
      const c = await this.companyRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return c ? { profileId: c.id, actorType: NotificationActorType.COMPANY, adminId: c.adminId } : null;
    }
    if (role === UserRole.DELIVERY) {
      const d = await this.deliveryRepo.findOne({ where: { user: { id: userId } } }).catch(() => null);
      return d ? { profileId: d.id, actorType: NotificationActorType.DELIVERY, adminId: d.adminId } : null;
    }
    return null;
  }

  /**
   * Suspend un acteur ACTIF de la zone (action de modération — distincte
   * du refus d'une demande PENDING, voir rejectValidation ci-dessus).
   *
   * Vérifie que l'acteur visé appartient bien à la zone de l'admin
   * appelant (sinon ForbiddenException) : sans ce contrôle, n'importe
   * quel admin pourrait suspendre l'acteur d'une AUTRE zone en appelant
   * la route directement avec un userId deviné/récupéré ailleurs.
   */
  async suspendActeur(adminUserId: string, targetUserId: string, motif?: string) {
    const admin = await this.zoneService.adminOf(adminUserId);
    const user  = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const profile = await this.resolveProfileWithZone(targetUserId, user.role);
    if (!profile || profile.adminId !== admin.id) {
      throw new ForbiddenException("Ce compte n'appartient pas à votre zone.");
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Ce compte est déjà suspendu.');
    }

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);
    await this.invalidateActeursCache(admin.id);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '🚫',
      action:     motif
        ? `a suspendu le compte de <b>${escapeHtml(userName(user))}</b> — motif : ${escapeHtml(motif)}`
        : `a suspendu le compte de <b>${escapeHtml(userName(user))}</b>`,
      targetType: 'user',
      targetId:   targetUserId,
    }));

    this.notifEvents.notifyActeurAccountSuspended({
      recipientType: profile.actorType,
      recipientId:   profile.profileId,
      motif:         motif ?? null,
    }).catch(() => {});

    return { message: 'Compte suspendu.' };
  }

  /**
   * Réactive un acteur SUSPENDU de la zone (l'inverse de suspendActeur
   * ci-dessus) — même vérification de zone.
   */
  async reactivateActeur(adminUserId: string, targetUserId: string) {
    const admin = await this.zoneService.adminOf(adminUserId);
    const user  = await this.userRepo.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const profile = await this.resolveProfileWithZone(targetUserId, user.role);
    if (!profile || profile.adminId !== admin.id) {
      throw new ForbiddenException("Ce compte n'appartient pas à votre zone.");
    }

    if (user.status !== UserStatus.SUSPENDED) {
      throw new BadRequestException("Ce compte n'est pas suspendu.");
    }

    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);
    await this.invalidateActeursCache(admin.id);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      actorId:    adminUserId,
      actorName:  admin.fullName,
      icon:       '✅',
      action:     `a réactivé le compte de <b>${escapeHtml(userName(user))}</b>`,
      targetType: 'user',
      targetId:   targetUserId,
    }));

    this.notifEvents.notifyActeurAccountReactivated({
      recipientType: profile.actorType,
      recipientId:   profile.profileId,
    }).catch(() => {});

    return { message: 'Compte réactivé.' };
  }
}
