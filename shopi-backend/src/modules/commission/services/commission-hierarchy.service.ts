/* ============================================================
 * FICHIER : src/modules/commission/services/commission-hierarchy.service.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Résout la chaîne hiérarchique complète de tous les acteurs
 * d'une commande.
 *
 * HIÉRARCHIE SHOPI
 * ─────────────────────────────────────────────────────────────
 *  ENTREPRISE
 *    └─ Partenaire (qui a créé l'entreprise via code invitation)
 *         └─ Admin (qui supervise ce Partenaire)
 *
 *  LIVREUR
 *    └─ Partenaire (qui a créé le livreur via code invitation)
 *         └─ Admin (qui supervise ce Partenaire)
 *
 *  CORRESPONDANT
 *    └─ Partenaire (qui a créé le correspondant via code invitation)
 *         └─ Admin (qui supervise ce Partenaire)
 *
 * CAS DÉGÉNÉRÉS (non bloquants)
 * ─────────────────────────────────────────────────────────────
 *  - Partenaire absent → part partenaire absorbée par Shopi
 *  - Admin absent      → part admin absorbée par Shopi
 *  - Ces cas sont loggués mais ne bloquent pas le calcul
 *
 * RÉSOLUTION DES IDS
 * ─────────────────────────────────────────────────────────────
 *  Company.partnerId  = Partner.id (profil)   → Partner.userId (wallet)
 *  Company.adminId    = Admin.id   (profil)   → Admin.userId   (wallet)
 *  Delivery.partnerId = Partner.id (profil)   → Partner.userId (wallet)
 *  Delivery.adminId   = Admin.id   (profil)   → Admin.userId   (wallet)
 *  Correspondent.partnerId = Partner.id       → Partner.userId (wallet)
 *    └─ puis Partner.adminId = Admin.id       → Admin.userId   (wallet)
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  Repository<Company>
 *  Repository<Partner>
 *  Repository<Admin>
 *  Repository<Delivery>
 *  Repository<Correspondent>
 *  Repository<User>
 *  CommissionRule (pour getPlanMultiplier)
 * ============================================================ */

import { Injectable, Logger }  from '@nestjs/common';
import { InjectRepository }    from '@nestjs/typeorm';
import { Repository }          from 'typeorm';

import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Admin }         from '../../../database/entities/profiles/admin-profile.entity';
import { User }          from '../../../database/entities/user.entity';
import { CommissionRule } from '../../../database/entities/paiement/commission-rule.entity';

import {
  CommissionHierarchy,
  ActeurEntrepriseHierarchy,
  ActeurLivraisonHierarchy,
  CommissionContext,
  CommissionErreur,
  CommissionErreurType,
} from '../types/commission.types';
import { CommissionConfigService } from './commission-config.service';

@Injectable()
export class CommissionHierarchyService {

  private readonly logger = new Logger(CommissionHierarchyService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly configService: CommissionConfigService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * resolveAll() — point d'entrée principal
   * ────────────────────────────────────────────────────────── */

  /**
   * Résout la hiérarchie complète pour tous les acteurs d'une commande.
   *
   * @param context Contexte de la commande (IDs des acteurs)
   * @param rule CommissionRule active (pour getPlanMultiplier)
   * @returns CommissionHierarchy avec tous les actors résolus
   */
  async resolveAll(
    context: CommissionContext,
    rule:    CommissionRule,
  ): Promise<CommissionHierarchy> {

    /* Résolution en parallèle pour performance */
    const [entreprise, livreur, correspondant, plateformeUserId] = await Promise.all([
      this.resolveEntreprise(context.companyId, rule),
      context.livreurId
        ? this.resolveLivreur(context.livreurId)
        : Promise.resolve(null),
      context.correspondantId
        ? this.resolveCorrespondant(context.correspondantId)
        : Promise.resolve(null),
      this.resolvePlatformeUserId(),
    ]);

    return { entreprise, livreur, correspondant, plateformeUserId };
  }

  /* ──────────────────────────────────────────────────────────
   * resolveEntreprise()
   * ────────────────────────────────────────────────────────── */

  /**
   * Résout la hiérarchie d'une entreprise.
   *
   * Charge Company par companyId, puis Partner par company.partnerId,
   * puis Admin par company.adminId.
   *
   * @throws CommissionErreur(ENTREPRISE_INTROUVABLE) si company absent
   */
  async resolveEntreprise(
    companyId: string,
    rule:      CommissionRule,
  ): Promise<ActeurEntrepriseHierarchy> {

    const company = await this.companyRepo.findOne({
      where:  { id: companyId },
      select: ['id', 'userId', 'companyName', 'plan', 'partnerId', 'adminId'] as any,
    });

    if (!company) {
      throw new CommissionErreur(
        CommissionErreurType.ENTREPRISE_INTROUVABLE,
        `Entreprise introuvable: ${companyId}`,
        { companyId },
      );
    }

    const plan = (company as any).plan as string ?? 'standard';
    const planMultiplier = this.configService.getPlanMultiplier(plan, rule);

    /* Résolution partenaire et admin en parallèle */
    const [partnerInfo, adminInfo] = await Promise.all([
      company.partnerId ? this.resolvePartner(company.partnerId) : Promise.resolve(null),
      company.adminId   ? this.resolveAdmin(company.adminId)     : Promise.resolve(null),
    ]);

    if (!partnerInfo && company.partnerId) {
      this.logger.warn(
        `[Hierarchy] Partenaire ${company.partnerId} de l'entreprise ${companyId} introuvable`,
      );
    }
    if (!adminInfo && company.adminId) {
      this.logger.warn(
        `[Hierarchy] Admin ${company.adminId} de l'entreprise ${companyId} introuvable`,
      );
    }

    return {
      profileId:           company.id,
      userId:              (company as any).userId as string,
      nom:                 (company as any).companyName as string ?? 'Entreprise',
      plan,
      planMultiplier,
      partenaireProfileId:    company.partnerId,
      partenaireUserId:       partnerInfo?.userId ?? null,
      partenaireNom:          partnerInfo?.nom    ?? null,
      partenaireTotalCompanies: partnerInfo?.totalCompanies ?? null,
      adminProfileId:         company.adminId,
      adminUserId:            adminInfo?.userId   ?? null,
      adminNom:               adminInfo?.nom      ?? null,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * resolveLivreur()
   * ────────────────────────────────────────────────────────── */

  /**
   * Résout la hiérarchie d'un livreur.
   *
   * Charge Delivery par livreurId.
   * Le livreur porte directement partnerId et adminId.
   *
   * @throws CommissionErreur(LIVREUR_INTROUVABLE) si absent
   */
  async resolveLivreur(livreurId: string): Promise<ActeurLivraisonHierarchy> {
    const livreur = await this.deliveryRepo.findOne({
      where:  { id: livreurId },
      select: ['id', 'userId', 'fullName', 'partnerId', 'adminId'] as any,
    });

    if (!livreur) {
      throw new CommissionErreur(
        CommissionErreurType.LIVREUR_INTROUVABLE,
        `Livreur introuvable: ${livreurId}`,
        { livreurId },
      );
    }

    const [partnerInfo, adminInfo] = await Promise.all([
      livreur.partnerId ? this.resolvePartner(livreur.partnerId) : Promise.resolve(null),
      livreur.adminId   ? this.resolveAdmin(livreur.adminId)     : Promise.resolve(null),
    ]);

    if (!partnerInfo && livreur.partnerId) {
      this.logger.warn(`[Hierarchy] Partenaire ${livreur.partnerId} du livreur ${livreurId} introuvable`);
    }

    return {
      profileId:           livreur.id,
      userId:              (livreur as any).userId as string,
      nom:                 (livreur as any).fullName as string ?? 'Livreur',
      partenaireProfileId: livreur.partnerId,
      partenaireUserId:    partnerInfo?.userId ?? null,
      partenaireNom:       partnerInfo?.nom    ?? null,
      adminProfileId:      livreur.adminId,
      adminUserId:         adminInfo?.userId   ?? null,
      adminNom:            adminInfo?.nom      ?? null,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * resolveCorrespondant()
   * ────────────────────────────────────────────────────────── */

  /**
   * Résout la hiérarchie d'un correspondant.
   *
   * Le correspondant a un partnerId direct.
   * L'admin est résolu via partner.adminId.
   *
   * @throws CommissionErreur(CORRESPONDANT_INTROUVABLE) si absent
   */
  async resolveCorrespondant(correspondantId: string): Promise<ActeurLivraisonHierarchy> {
    const correspondant = await this.correspondantRepo.findOne({
      where:  { id: correspondantId },
      select: ['id', 'userId', 'fullName', 'partnerId'] as any,
    });

    if (!correspondant) {
      throw new CommissionErreur(
        CommissionErreurType.CORRESPONDANT_INTROUVABLE,
        `Correspondant introuvable: ${correspondantId}`,
        { correspondantId },
      );
    }

    /* Résoudre le partenaire, puis l'admin du partenaire */
    let partnerInfo: { userId: string; nom: string; adminId: string | null } | null = null;
    let adminInfo:   { userId: string; nom: string } | null = null;

    if (correspondant.partnerId) {
      const partner = await this.partnerRepo.findOne({
        where:  { id: correspondant.partnerId },
        select: ['id', 'userId', 'name', 'adminId'] as any,
      });
      if (partner) {
        partnerInfo = {
          userId:  (partner as any).userId as string,
          nom:     (partner as any).name   as string ?? 'Partenaire',
          adminId: (partner as any).adminId as string | null,
        };
        /* Résoudre l'admin du partenaire */
        if (partnerInfo.adminId) {
          adminInfo = await this.resolveAdmin(partnerInfo.adminId);
        }
      }
    }

    return {
      profileId:           correspondant.id,
      userId:              (correspondant as any).userId as string,
      nom:                 (correspondant as any).fullName as string ?? 'Correspondant',
      partenaireProfileId: correspondant.partnerId,
      partenaireUserId:    partnerInfo?.userId  ?? null,
      partenaireNom:       partnerInfo?.nom     ?? null,
      adminProfileId:      partnerInfo?.adminId ?? null,
      adminUserId:         adminInfo?.userId    ?? null,
      adminNom:            adminInfo?.nom       ?? null,
    };
  }

  /* ──────────────────────────────────────────────────────────
   * resolvePlatformeUserId() — userId Shopi
   * ────────────────────────────────────────────────────────── */

  /**
   * Retourne le userId du compte Shopi (super_admin).
   * Ce userId est celui qui détient le wallet "Plateforme".
   *
   * Stratégie : premier super_admin actif dans la base.
   * Si absent (rare), retourne une chaîne vide (bloquée par le validator).
   */
  async resolvePlatformeUserId(): Promise<string> {
    const superAdmin = await this.userRepo.findOne({
      where:  { role: 'super_admin' as any },
      select: ['id'],
      order:  { createdAt: 'ASC' } as any,
    });

    if (!superAdmin) {
      this.logger.warn('[Hierarchy] Aucun super_admin trouvé — wallet plateforme introuvable');
      return '';
    }

    return superAdmin.id;
  }

  /* ──────────────────────────────────────────────────────────
   * Helpers privés
   * ────────────────────────────────────────────────────────── */

  /**
   * Charge un Partner par son profileId et retourne userId + nom
   * (+ totalCompanies, utilisé par CommissionCalculatorService pour
   * résoudre le tier de PartnerSettings côté commission produit).
   * Retourne null si introuvable (cas géré comme non bloquant).
   */
  private async resolvePartner(partnerProfileId: string): Promise<{ userId: string; nom: string; totalCompanies: number } | null> {
    const partner = await this.partnerRepo.findOne({
      where:  { id: partnerProfileId },
      select: ['id', 'userId', 'name', 'totalCompanies'] as any,
    });

    if (!partner) return null;

    return {
      userId:         (partner as any).userId as string,
      nom:            (partner as any).name   as string ?? 'Partenaire',
      totalCompanies: Number((partner as any).totalCompanies ?? 0),
    };
  }

  /**
   * Charge un Admin par son profileId et retourne userId + nom.
   * Retourne null si introuvable (cas géré comme non bloquant).
   */
  private async resolveAdmin(adminProfileId: string): Promise<{ userId: string; nom: string } | null> {
    const admin = await this.adminRepo.findOne({
      where:  { id: adminProfileId },
      select: ['id', 'userId', 'fullName'] as any,
    });

    if (!admin) return null;

    return {
      userId: (admin as any).userId   as string,
      nom:    (admin as any).fullName as string ?? 'Admin',
    };
  }
}
