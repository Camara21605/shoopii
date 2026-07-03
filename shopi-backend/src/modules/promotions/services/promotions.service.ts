/* ============================================================
 * FICHIER : src/modules/promotions/services/promotions.service.ts
 *
 * RÔLE    : Gestion CRUD complète des promotions.
 *           Appelé par PromotionsController pour toutes les
 *           opérations sur la table "promotions".
 *
 * ─── MÉTHODES PUBLIQUES ──────────────────────────────────────
 *
 *  create(dto, user)              → créer une nouvelle promo
 *  findAll(dto, user)             → lister les promos de l'entreprise
 *  findOne(id, user)              → détail d'une promo
 *  update(id, dto, user)          → modifier une promo
 *  remove(id, user)               → supprimer une promo
 *  activate(id, user)             → passer status → ACTIVE
 *  pause(id, user)                → passer status → PAUSED
 *  end(id, user)                  → passer status → ENDED
 *
 * ─── RÈGLES MÉTIER ───────────────────────────────────────────
 *
 *  1. Une promo appartient à une entreprise identifiée via userId JWT
 *     → on résout toujours companyProfile depuis userId avant tout
 *
 *  2. Le code promo est UNIQUE par entreprise
 *     → on vérifie l'unicité (companyId + code) avant création
 *
 *  3. scope = products → productIds obligatoires
 *     → on crée les lignes PromotionProduct dans la même transaction
 *
 *  4. On ne peut modifier ou supprimer qu'une promo qui
 *     appartient à l'entreprise connectée (ownership check)
 *
 *  5. Une promo ACTIVE ne peut pas être supprimée directement
 *     → la mettre en pause d'abord
 *
 * ============================================================ */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, ILike } from 'typeorm';

import {
  Promotion,
  PromoStatus,
  PromoScope,
} from 'src/database/entities/entreprise.table/promotion.entity';
import { PromotionProduct }
  from 'src/database/entities/entreprise.table/promotion-product.entity';
import { Company }
  from 'src/database/entities/profiles/entreprise-profile.entity';
import { Product }
  from 'src/database/entities/entreprise.table/product.entity';
import { User }
  from 'src/database/entities/user.entity';

import {
  CreatePromotionDto,
  UpdatePromotionDto,
  FilterPromotionsDto,
} from '../dto/promotion.dto';
import { NotificationType } from 'src/database/entities/notification/notification.entitiy';
import { NotificationEventService } from 'src/modules/notifications/events/notification-event.service';

// ─────────────────────────────────────────────────────────────
// INTERFACE DE RÉPONSE PROMO
// Alignée sur la structure attendue par PromotionsPage.tsx
// ─────────────────────────────────────────────────────────────

export interface PromoResponse {
  id:           string;
  nom:          string;
  code:         string;
  type:         string;
  typeL:        string;          // label lisible (ex: "Réduction %")
  scope:        string;
  status:       string;
  valueType:    string;
  valeur:       number | null;
  montantMinimum:     number | null;
  plafondReduction:   number | null;
  maxUtilisations:    number | null;
  maxParClient:       number;
  uses:               number;    // alias de usesCount pour le frontend
  max:                number;    // alias de maxUtilisations pour le frontend
  revenue:            string;    // caGenere formaté en string
  caGenere:           number;
  startDate:    string | null;
  endDate:      string | null;
  expire:       string;          // date d'expiration formatée lisible
  flashStock:          number | null;
  bundleQuantiteMin:   number | null;
  bundleQuantiteOfferte: number | null;
  freeShipSeuil:       number | null;
  description:  string | null;
  companyId:    string;
  productIds:   string[];        // IDs des produits ciblés (scope=products)
  produits:     { id: string; productId: string; nom?: string }[];
  createdAt:    string;
  updatedAt:    string;
}

// Labels lisibles pour le frontend
const TYPE_LABELS: Record<string, string> = {
  discount:   'Réduction %',
  'free-ship':'Livraison offerte',
  bundle:     'Bundle',
  flash:      'Vente flash',
};

@Injectable()
export class PromotionsService {

  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectRepository(Promotion)
    private readonly promoRepo: Repository<Promotion>,

    @InjectRepository(PromotionProduct)
    private readonly promoProdRepo: Repository<PromotionProduct>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly dataSource: DataSource,
    private readonly notifEventSvc: NotificationEventService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Résoudre le profil Company depuis le userId JWT
  //
  // Appelée au début de chaque méthode publique.
  // Garantit que le user connecté est bien une entreprise avec un profil.
  // ══════════════════════════════════════════════════════════════════════════

  private async resolveCompany(userId: string): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) {
      throw new NotFoundException(
        'Profil entreprise introuvable. ' +
        'Vérifiez que le compte a été créé avec le rôle company.',
      );
    }
    return company;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Vérifier qu'une promo appartient à l'entreprise
  //
  // Appelée avant toute modification ou suppression.
  // Lance ForbiddenException si la promo n'appartient pas à cette entreprise.
  // ══════════════════════════════════════════════════════════════════════════

  private async findAndVerifyOwnership(
    promoId:   string,
    companyId: string,
  ): Promise<Promotion> {
    const promo = await this.promoRepo.findOne({
      where:   { id: promoId },
      relations: ['produits'],
    });

    if (!promo) {
      throw new NotFoundException(`Promotion introuvable (ID: ${promoId}).`);
    }

    if (promo.companyId !== companyId) {
      throw new ForbiddenException(
        'Accès refusé — cette promotion n\'appartient pas à votre entreprise.',
      );
    }

    return promo;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Vérifier l'unicité du code par entreprise
  //
  // Deux entreprises PEUVENT avoir le même code.
  // Mais une entreprise ne PEUT PAS avoir deux promos avec le même code.
  // ══════════════════════════════════════════════════════════════════════════

  private async checkCodeUniqueness(
    code:       string,
    companyId:  string,
    excludeId?: string,   // pour exclure la promo actuelle lors d'un update
  ): Promise<void> {
    const qb = this.promoRepo
      .createQueryBuilder('p')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('UPPER(p.code) = :code',  { code: code.toUpperCase() });

    if (excludeId) {
      qb.andWhere('p.id != :excludeId', { excludeId });
    }

    const exists = await qb.getExists();
    if (exists) {
      throw new ConflictException(
        `Le code promo "${code.toUpperCase()}" est déjà utilisé par votre entreprise.`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Valider les produits ciblés (scope = products)
  //
  // Vérifie que :
  //   1. productIds n'est pas vide
  //   2. Chaque produit existe en base
  //   3. Chaque produit appartient à l'entreprise
  // ══════════════════════════════════════════════════════════════════════════

  private async validateProductIds(
    productIds: string[],
    companyId:  string,
  ): Promise<void> {
    if (!productIds || productIds.length === 0) {
      throw new BadRequestException(
        'Vous devez sélectionner au moins un produit ' +
        'quand la portée est "Produit(s) spécifique(s)".',
      );
    }

    // Charger tous les produits en une seule requête
    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: productIds })
      .getMany();

    // Vérifier que tous les IDs ont été trouvés
    if (products.length !== productIds.length) {
      const foundIds   = products.map(p => p.id);
      const missingIds = productIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException(
        `Produit(s) introuvable(s) : ${missingIds.join(', ')}`,
      );
    }

    // Vérifier que tous appartiennent à l'entreprise
    const foreignProducts = products.filter(p => p.companyId !== companyId);
    if (foreignProducts.length > 0) {
      const foreignIds = foreignProducts.map(p => p.id);
      throw new ForbiddenException(
        `Ces produits n'appartiennent pas à votre entreprise : ${foreignIds.join(', ')}`,
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Formater la date d'expiration pour le frontend
  //
  // Retourne une string lisible.
  // Ex: "31 déc. 2025" ou "Pas de limite"
  // ══════════════════════════════════════════════════════════════════════════

  private formatExpire(endDate: Date | null): string {
    if (!endDate) return 'Pas de limite';
    return new Intl.DateTimeFormat('fr-FR', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    }).format(new Date(endDate));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Formater le CA généré pour le frontend
  //
  // Retourne une string lisible.
  // Ex: "18.4M GNF" ou "250 000 GNF"
  // ══════════════════════════════════════════════════════════════════════════

  private formatRevenue(caGenere: number): string {
    if (caGenere >= 1_000_000) {
      return `${(caGenere / 1_000_000).toFixed(1)}M GNF`;
    }
    if (caGenere >= 1_000) {
      return `${Math.round(caGenere / 1_000)} 000 GNF`;
    }
    return `${caGenere} GNF`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Mapper une Promotion vers PromoResponse
  //
  // Transforme l'entité TypeORM en objet propre pour le frontend.
  // Correspond exactement à la structure attendue par PromotionsPage.tsx.
  // ══════════════════════════════════════════════════════════════════════════

  private toResponse(promo: Promotion): PromoResponse {
    const productIds = (promo.produits ?? []).map(pp => pp.productId);

    return {
      id:           promo.id,
      nom:          promo.nom,
      code:         promo.code,
      type:         promo.type,
      typeL:        TYPE_LABELS[promo.type] ?? promo.type,
      scope:        promo.scope,
      status:       promo.status,
      valueType:    promo.valueType,
      valeur:       promo.valeur,
      montantMinimum:      Number(promo.montantMinimum)   || null,
      plafondReduction:    Number(promo.plafondReduction)  || null,
      maxUtilisations:     promo.maxUtilisations           ?? null,
      maxParClient:        promo.maxParClient,
      uses:                promo.usesCount,
      max:                 promo.maxUtilisations ?? 0,
      caGenere:            Number(promo.caGenere) || 0,
      revenue:             this.formatRevenue(Number(promo.caGenere) || 0),
      startDate:           promo.startDate  ? new Date(promo.startDate).toISOString()  : null,
      endDate:             promo.endDate    ? new Date(promo.endDate).toISOString()    : null,
      expire:              this.formatExpire(promo.endDate),
      flashStock:          promo.flashStock           ?? null,
      bundleQuantiteMin:   promo.bundleQuantiteMin    ?? null,
      bundleQuantiteOfferte: promo.bundleQuantiteOfferte ?? null,
      freeShipSeuil:       Number(promo.freeShipSeuil) || null,
      description:         promo.description ?? null,
      companyId:           promo.companyId,
      productIds,
      produits:            (promo.produits ?? []).map(pp => ({
        id:        pp.id,
        productId: pp.productId,
      })),
      createdAt: promo.createdAt?.toISOString() ?? '',
      updatedAt: promo.updatedAt?.toISOString() ?? '',
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CREATE — POST /promotions
  //
  // Crée une nouvelle promotion dans une transaction atomique :
  //   Étape 1 : Résoudre le profil Company du user connecté
  //   Étape 2 : Vérifier l'unicité du code pour cette entreprise
  //   Étape 3 : Si scope = products → valider les produits ciblés
  //   Étape 4 : Créer la Promotion
  //   Étape 5 : Créer les PromotionProduct (si scope = products)
  //   Étape 6 : Commit ou Rollback
  // ══════════════════════════════════════════════════════════════════════════

  async create(dto: CreatePromotionDto, user: User): Promise<PromoResponse> {

    // Étape 1 — Résoudre le profil Company
    const company = await this.resolveCompany(user.id);

    // Étape 2 — Vérifier l'unicité du code
    await this.checkCodeUniqueness(dto.code, company.id);

    // Étape 3 — Valider les produits si scope = products
    const scope      = dto.scope ?? PromoScope.GLOBAL;
    const productIds = dto.productIds ?? [];

    if (scope === PromoScope.PRODUCTS) {
      await this.validateProductIds(productIds, company.id);
    }

    // Étapes 4 & 5 — Transaction atomique
    let newPromo: Promotion;
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {

      // ── Créer la Promotion ────────────────────────────────────────────────
      const promoEntity = this.promoRepo.create({
        companyId:           company.id,
        nom:                 dto.nom.trim(),
        code:                dto.code.toUpperCase().trim(),  // toujours en MAJUSCULES
        type:                dto.type,
        scope,
        status:              PromoStatus.DRAFT,              // toujours DRAFT à la création
        valueType:           dto.valueType,
        valeur:              dto.valeur              ?? null,
        montantMinimum:      dto.montantMinimum      ?? null,
        plafondReduction:    dto.plafondReduction    ?? null,
        maxUtilisations:     dto.maxUtilisations     ?? null,
        maxParClient:        dto.maxParClient        ?? 1,
        startDate:           dto.startDate   ? new Date(dto.startDate)  : null,
        endDate:             dto.endDate     ? new Date(dto.endDate)    : null,
        flashStock:          dto.flashStock          ?? null,
        bundleQuantiteMin:   dto.bundleQuantiteMin   ?? null,
        bundleQuantiteOfferte: dto.bundleQuantiteOfferte ?? null,
        freeShipSeuil:       dto.freeShipSeuil       ?? null,
        description:         dto.description?.trim() ?? null,
        usesCount:           0,
        caGenere:            0,
      });

      newPromo = await qr.manager.save(Promotion, promoEntity);

      // ── Créer les PromotionProduct si scope = products ────────────────────
      if (scope === PromoScope.PRODUCTS && productIds.length > 0) {
        const promoProdEntities = productIds.map(productId =>
          this.promoProdRepo.create({
            promotionId: newPromo.id,
            productId,
          }),
        );
        await qr.manager.save(PromotionProduct, promoProdEntities);
      }

      await qr.commitTransaction();

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(
        `[CREATE PROMO ❌] Rollback — Company=${company.id} | ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(
      `[CREATE PROMO ✅] ID=${newPromo.id} | Code=${newPromo.code} | Company=${company.id}`,
    );

    // Recharger avec les relations pour la réponse complète
    return this.findOne(newPromo.id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. FIND ALL — GET /promotions
  //
  // Liste toutes les promotions de l'entreprise connectée.
  // Supporte le filtrage par statut, type, scope et la recherche.
  // Pagination incluse.
  // ══════════════════════════════════════════════════════════════════════════

  async findAll(
    dto:  FilterPromotionsDto,
    user: User,
  ): Promise<{ data: PromoResponse[]; total: number; page: number; pages: number }> {

    const company = await this.resolveCompany(user.id);
    const page    = dto.page  ?? 1;
    const limit   = dto.limit ?? 20;

    // Construction du QueryBuilder avec filtres optionnels
    const qb = this.promoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.produits', 'produits')
      .where('p.companyId = :companyId', { companyId: company.id })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    // Filtrer par statut (onglets de PromotionsPage.tsx)
    if (dto.status) {
      qb.andWhere('p.status = :status', { status: dto.status });
    }

    // Filtrer par type
    if (dto.type) {
      qb.andWhere('p.type = :type', { type: dto.type });
    }

    // Filtrer par portée
    if (dto.scope) {
      qb.andWhere('p.scope = :scope', { scope: dto.scope });
    }

    // Recherche sur le nom ou le code
    if (dto.search?.trim()) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(p.nom LIKE :term OR p.code LIKE :term)',
        { term },
      );
    }

    const [promos, total] = await qb.getManyAndCount();

    return {
      data:  promos.map(p => this.toResponse(p)),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. FIND ONE — GET /promotions/:id
  //
  // Retourne le détail complet d'une promotion.
  // Vérifie que la promo appartient à l'entreprise connectée.
  // ══════════════════════════════════════════════════════════════════════════

  async findOne(id: string, user: User): Promise<PromoResponse> {
    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);
    return this.toResponse(promo);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. UPDATE — PATCH /promotions/:id
  //
  // Modifie une promotion existante dans une transaction atomique :
  //   Étape 1 : Vérifier ownership
  //   Étape 2 : Vérifier unicité du code si modifié
  //   Étape 3 : Si scope = products → valider les nouveaux produits
  //   Étape 4 : Mettre à jour la Promotion
  //   Étape 5 : Remplacer les PromotionProduct si productIds changent
  // ══════════════════════════════════════════════════════════════════════════

  async update(
    id:   string,
    dto:  UpdatePromotionDto,
    user: User,
  ): Promise<PromoResponse> {

    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);

    // Vérifier unicité du code si le code change
    if (dto.code && dto.code.toUpperCase() !== promo.code) {
      await this.checkCodeUniqueness(dto.code, company.id, id);
    }

    // Résoudre le scope final (celui du DTO ou celui existant)
    const newScope      = dto.scope      ?? promo.scope;
    const newProductIds = dto.productIds ?? null;  // null = pas de changement

    // Valider les nouveaux produits si scope = products ET productIds fournis
    if (newScope === PromoScope.PRODUCTS && newProductIds !== null) {
      await this.validateProductIds(newProductIds, company.id);
    }

    // Transaction atomique
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {

      // Mise à jour des champs modifiés (seulement ceux fournis dans le DTO)
      Object.assign(promo, {
        nom:                 dto.nom?.trim()         ?? promo.nom,
        code:                dto.code               ? dto.code.toUpperCase().trim() : promo.code,
        type:                dto.type               ?? promo.type,
        scope:               newScope,
        valueType:           dto.valueType          ?? promo.valueType,
        valeur:              dto.valeur             ?? promo.valeur,
        montantMinimum:      dto.montantMinimum     ?? promo.montantMinimum,
        plafondReduction:    dto.plafondReduction   ?? promo.plafondReduction,
        maxUtilisations:     dto.maxUtilisations    ?? promo.maxUtilisations,
        maxParClient:        dto.maxParClient       ?? promo.maxParClient,
        startDate:           dto.startDate  ? new Date(dto.startDate)  : promo.startDate,
        endDate:             dto.endDate    ? new Date(dto.endDate)    : promo.endDate,
        flashStock:          dto.flashStock         ?? promo.flashStock,
        bundleQuantiteMin:   dto.bundleQuantiteMin  ?? promo.bundleQuantiteMin,
        bundleQuantiteOfferte: dto.bundleQuantiteOfferte ?? promo.bundleQuantiteOfferte,
        freeShipSeuil:       dto.freeShipSeuil      ?? promo.freeShipSeuil,
        description:         dto.description?.trim() ?? promo.description,
      });

      await qr.manager.save(Promotion, promo);

      // Remplacer les produits ciblés si productIds est fourni dans le DTO
      if (newProductIds !== null) {
        // Supprimer les anciennes lignes
        await qr.manager.delete(PromotionProduct, { promotionId: id });

        // Créer les nouvelles si scope = products
        if (newScope === PromoScope.PRODUCTS && newProductIds.length > 0) {
          const newEntities = newProductIds.map(productId =>
            this.promoProdRepo.create({ promotionId: id, productId }),
          );
          await qr.manager.save(PromotionProduct, newEntities);
        }
      }

      await qr.commitTransaction();

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(
        `[UPDATE PROMO ❌] ID=${id} | ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await qr.release();
    }

    this.logger.log(`[UPDATE PROMO ✅] ID=${id} | Company=${company.id}`);
    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. REMOVE — DELETE /promotions/:id
  //
  // Supprime une promotion et toutes ses lignes liées (CASCADE en BDD).
  // Refus si la promo est ACTIVE → la mettre en PAUSED d'abord.
  // ══════════════════════════════════════════════════════════════════════════

  async remove(id: string, user: User): Promise<{ message: string }> {
    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);

    // Sécurité : on ne supprime pas une promo ACTIVE
    if (promo.status === PromoStatus.ACTIVE) {
      throw new BadRequestException(
        'Impossible de supprimer une promotion active. ' +
        'Mettez-la en pause d\'abord via PATCH /promotions/:id/pause.',
      );
    }

    await this.promoRepo.remove(promo);

    this.logger.log(`[DELETE PROMO ✅] ID=${id} | Company=${company.id}`);
    return { message: `Promotion "${promo.nom}" supprimée avec succès.` };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. ACTIVATE — PATCH /promotions/:id/activate
  //
  // Passe la promotion de DRAFT ou PAUSED → ACTIVE.
  // Vérifie que la promo est valide avant l'activation :
  //   - scope = products → au moins 1 produit ciblé
  //   - endDate non dépassée
  // ══════════════════════════════════════════════════════════════════════════

  async activate(id: string, user: User): Promise<PromoResponse> {
    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);

    // Vérifier que le statut permet l'activation
    if (promo.status === PromoStatus.ACTIVE) {
      throw new BadRequestException('Cette promotion est déjà active.');
    }
    if (promo.status === PromoStatus.ENDED) {
      throw new BadRequestException(
        'Cette promotion est terminée. Créez-en une nouvelle.',
      );
    }

    // Vérifier que la date d'expiration n'est pas dépassée
    if (promo.endDate && new Date(promo.endDate) < new Date()) {
      throw new BadRequestException(
        'La date d\'expiration de cette promotion est dépassée. ' +
        'Modifiez la date avant d\'activer.',
      );
    }

    // Vérifier que scope = products a au moins un produit
    if (promo.scope === PromoScope.PRODUCTS) {
      const count = await this.promoProdRepo.count({
        where: { promotionId: id },
      });
      if (count === 0) {
        throw new BadRequestException(
          'Cette promotion cible des produits spécifiques ' +
          'mais aucun produit n\'est sélectionné.',
        );
      }
    }

    await this.promoRepo.update(id, { status: PromoStatus.ACTIVE });

    this.logger.log(`[ACTIVATE PROMO ✅] ID=${id} | Company=${company.id}`);

    void this.notifEventSvc.notifyPromoEvent({
      companyId: company.id,
      promoId:   id,
      promoCode: promo.code,
      type:      NotificationType.PROMO_ACTIVE,
      title:     'Promotion activée 🎉',
      body:      `Votre promotion "${promo.nom}" (code : ${promo.code}) est maintenant active.`,
    });

    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 7. PAUSE — PATCH /promotions/:id/pause
  //
  // Passe la promotion de ACTIVE → PAUSED.
  // ══════════════════════════════════════════════════════════════════════════

  async pause(id: string, user: User): Promise<PromoResponse> {
    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);

    if (promo.status !== PromoStatus.ACTIVE) {
      throw new BadRequestException(
        `Impossible de mettre en pause une promotion avec le statut "${promo.status}". ` +
        'Seules les promotions ACTIVE peuvent être mises en pause.',
      );
    }

    await this.promoRepo.update(id, { status: PromoStatus.PAUSED });

    this.logger.log(`[PAUSE PROMO ✅] ID=${id} | Company=${company.id}`);
    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 8. END — PATCH /promotions/:id/end
  //
  // Termine manuellement une promotion → status = ENDED.
  // ══════════════════════════════════════════════════════════════════════════

  async end(id: string, user: User): Promise<PromoResponse> {
    const company = await this.resolveCompany(user.id);
    const promo   = await this.findAndVerifyOwnership(id, company.id);

    if (promo.status === PromoStatus.ENDED) {
      throw new BadRequestException('Cette promotion est déjà terminée.');
    }

    await this.promoRepo.update(id, { status: PromoStatus.ENDED });

    this.logger.log(`[END PROMO ✅] ID=${id} | Company=${company.id}`);

    void this.notifEventSvc.notifyPromoEvent({
      companyId: company.id,
      promoId:   id,
      promoCode: promo.code,
      type:      NotificationType.PROMO_ENDED,
      title:     'Promotion terminée',
      body:      `Votre promotion "${promo.nom}" (code : ${promo.code}) est terminée.`,
    });

    return this.findOne(id, user);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 9. GET STATS — GET /promotions/stats
  //
  // Retourne les KPIs agrégés de toutes les promotions de l'entreprise.
  // Correspond aux 4 KPI cards de PromotionsPage.tsx.
  // ══════════════════════════════════════════════════════════════════════════

  async getStats(user: User): Promise<{
    total:       number;
    actives:     number;
    planifiees:  number;
    brouillons:  number;
    totalUses:   number;
    totalCa:     number;
  }> {
    const company = await this.resolveCompany(user.id);

    // Une seule requête agrégée pour tous les compteurs
    const result = await this.promoRepo
      .createQueryBuilder('p')
      .select('COUNT(*)',                                  'total')
      .addSelect('SUM(CASE WHEN p.status = :active THEN 1 ELSE 0 END)', 'actives')
      .addSelect('SUM(CASE WHEN p.status = :sched  THEN 1 ELSE 0 END)', 'planifiees')
      .addSelect('SUM(CASE WHEN p.status = :draft  THEN 1 ELSE 0 END)', 'brouillons')
      .addSelect('SUM(p.usesCount)',                       'totalUses')
      .addSelect('SUM(p.caGenere)',                        'totalCa')
      .where('p.companyId = :companyId', { companyId: company.id })
      .setParameters({
        active: PromoStatus.ACTIVE,
        sched:  PromoStatus.SCHEDULED,
        draft:  PromoStatus.DRAFT,
      })
      .getRawOne();

    return {
      total:      Number(result.total)      || 0,
      actives:    Number(result.actives)    || 0,
      planifiees: Number(result.planifiees) || 0,
      brouillons: Number(result.brouillons) || 0,
      totalUses:  Number(result.totalUses)  || 0,
      totalCa:    Number(result.totalCa)    || 0,
    };
  }
}