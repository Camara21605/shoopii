/* ============================================================
 * FICHIER : src/modules/promotions/services/promo-code.service.ts
 *
 * RÔLE    : Validation d'un code promo au moment du checkout.
 *           C'est CE service qui est appelé quand le client
 *           saisit un code promo dans son panier.
 *
 * ─── MÉTHODES PUBLIQUES ──────────────────────────────────────
 *
 *  validateCode(dto)   → valider le code + calculer la réduction
 *  applyCode(dto, user)→ créer l'entrée PromotionUsage + incrémenter usesCount
 *
 * ─── FLUX COMPLET AU CHECKOUT ────────────────────────────────
 *
 *  1. Client saisit un code promo dans son panier
 *  2. Frontend appelle POST /promotions/validate-code
 *     → PromoCodeService.validateCode(dto)
 *     → Retourne { valid, discount, newTotal, promo }
 *
 *  3. Client confirme sa commande
 *  4. CommandesService (au moment de créer la commande) appelle
 *     PromoCodeService.applyCode(...)
 *     → Crée PromotionUsage + incrémente usesCount + met à jour caGenere
 *
 * ─── VÉRIFICATIONS FAITES DANS validateCode ──────────────────
 *
 *  ✅ Code existe et appartient à la bonne entreprise
 *  ✅ Status = ACTIVE
 *  ✅ Date de validité (startDate <= now <= endDate)
 *  ✅ Stock flash non épuisé (si type = flash)
 *  ✅ Limite totale d'utilisations non atteinte
 *  ✅ Limite par client non atteinte
 *  ✅ Montant minimum du panier respecté
 *  ✅ Scope = products → au moins un produit du panier est ciblé
 *
 * ─── CALCUL DE LA RÉDUCTION ──────────────────────────────────
 *
 *  valueType = percent → discount = Math.min(cartTotal * valeur/100, plafond)
 *  valueType = fixed   → discount = Math.min(valeur, cartTotal)
 *  valueType = free    → discount = 0 (livraison offerte, gérée séparément)
 *  type = free-ship    → discount = 0 (frais de livraison = 0)
 *
 * ============================================================ */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import {
  Promotion,
  PromoStatus,
  PromoScope,
  PromoType,
  PromoValueType,
} from 'src/database/entities/entreprise.table/promotion.entity';
import { PromotionProduct }
  from 'src/database/entities/entreprise.table/promotion-product.entity';
import { PromotionUsage }
  from 'src/database/entities/entreprise.table/promotion-usage.entity';

import { ValidateCodeDto } from '../dto/promotion.dto';

// ─────────────────────────────────────────────────────────────
// INTERFACE DE RÉPONSE — POST /promotions/validate-code
// ─────────────────────────────────────────────────────────────

export interface ValidateCodeResponse {
  /** true si le code est valide et applicable */
  valid: boolean;

  /** Montant de la réduction en GNF (0 si livraison offerte) */
  discount: number;

  /** Nouveau total du panier après réduction */
  newTotal: number;

  /** true si la livraison est offerte */
  freeShipping: boolean;

  /** Résumé de la réduction pour affichage */
  label: string;

  /** Détails de la promotion appliquée */
  promo: {
    id:       string;
    nom:      string;
    code:     string;
    type:     string;
    scope:    string;
    valeur:   number | null;
    valueType: string;
  };
}

@Injectable()
export class PromoCodeService {

  private readonly logger = new Logger(PromoCodeService.name);

  constructor(
    @InjectRepository(Promotion)
    private readonly promoRepo: Repository<Promotion>,

    @InjectRepository(PromotionProduct)
    private readonly promoProdRepo: Repository<PromotionProduct>,

    @InjectRepository(PromotionUsage)
    private readonly promoUsageRepo: Repository<PromotionUsage>,

    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Charger la promo depuis le code + companyId
  //
  // On recherche par (code UPPER + companyId) pour garantir
  // l'isolation entre entreprises qui peuvent avoir le même code.
  // ══════════════════════════════════════════════════════════════════════════

  private async loadPromo(code: string, companyId: string): Promise<Promotion> {
    const promo = await this.promoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.produits', 'produits')
      .where('UPPER(p.code) = :code',       { code: code.toUpperCase() })
      .andWhere('p.companyId = :companyId', { companyId })
      .getOne();

    if (!promo) {
      throw new NotFoundException(
        `Le code promo "${code.toUpperCase()}" n'existe pas ou n'est pas valide pour cette boutique.`,
      );
    }

    return promo;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Calculer le montant de la réduction
  //
  // Retourne le montant à déduire du panier en GNF.
  // ══════════════════════════════════════════════════════════════════════════

  private calculateDiscount(promo: Promotion, cartTotal: number): number {
    const valeur = Number(promo.valeur) || 0;

    switch (promo.valueType) {

      case PromoValueType.PERCENT: {
        // Réduction en pourcentage avec plafond optionnel
        const rawDiscount = Math.round(cartTotal * (valeur / 100));
        const plafond     = Number(promo.plafondReduction) || Infinity;
        return Math.min(rawDiscount, plafond);
      }

      case PromoValueType.FIXED: {
        // Réduction fixe en GNF — ne peut pas dépasser le total du panier
        return Math.min(valeur, cartTotal);
      }

      case PromoValueType.FREE: {
        // Livraison gratuite → réduction = 0 sur les produits
        // Les frais de livraison sont gérés dans CommandesService
        return 0;
      }

      default:
        return 0;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MÉTHODE PRIVÉE — Générer le label lisible de la réduction
  //
  // Ex: "-20% appliqué", "-5 000 GNF déduit", "Livraison offerte"
  // ══════════════════════════════════════════════════════════════════════════

  private buildLabel(promo: Promotion, discount: number): string {
    if (promo.type === PromoType.FREE_SHIP || promo.valueType === PromoValueType.FREE) {
      const seuil = Number(promo.freeShipSeuil);
      return seuil > 0
        ? `Livraison offerte pour commande > ${seuil.toLocaleString('fr-FR')} GNF`
        : 'Livraison offerte';
    }

    if (promo.valueType === PromoValueType.PERCENT) {
      const valeur = Number(promo.valeur);
      return `-${valeur}% appliqué · -${discount.toLocaleString('fr-FR')} GNF déduit`;
    }

    if (promo.valueType === PromoValueType.FIXED) {
      return `-${discount.toLocaleString('fr-FR')} GNF déduit`;
    }

    return `Code "${promo.code}" appliqué`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. VALIDATE CODE — POST /promotions/validate-code
  //
  // Vérifie toutes les conditions d'un code promo et calcule la réduction.
  // NE crée PAS d'entrée PromotionUsage (c'est applyCode qui le fait).
  // ══════════════════════════════════════════════════════════════════════════

  async validateCode(dto: ValidateCodeDto): Promise<ValidateCodeResponse> {

    // ── Charger la promo ───────────────────────────────────────────────────
    const promo = await this.loadPromo(dto.code, dto.companyId);

    // ── Vérification 1 : Statut ────────────────────────────────────────────
    if (promo.status !== PromoStatus.ACTIVE) {
      throw new BadRequestException(
        `Le code "${promo.code}" n'est pas actif (statut : ${promo.status}).`,
      );
    }

    // ── Vérification 2 : Date de début ────────────────────────────────────
    const now = new Date();
    if (promo.startDate && new Date(promo.startDate) > now) {
      throw new BadRequestException(
        `Le code "${promo.code}" sera valide à partir du ` +
        `${new Intl.DateTimeFormat('fr-FR').format(new Date(promo.startDate))}.`,
      );
    }

    // ── Vérification 3 : Date de fin ──────────────────────────────────────
    if (promo.endDate && new Date(promo.endDate) < now) {
      throw new BadRequestException(
        `Le code "${promo.code}" a expiré le ` +
        `${new Intl.DateTimeFormat('fr-FR').format(new Date(promo.endDate))}.`,
      );
    }

    // ── Vérification 4 : Limite totale d'utilisations ─────────────────────
    if (
      promo.maxUtilisations !== null &&
      promo.usesCount >= promo.maxUtilisations
    ) {
      throw new BadRequestException(
        `Le code "${promo.code}" a atteint sa limite d'utilisations.`,
      );
    }

    // ── Vérification 5 : Stock flash ──────────────────────────────────────
    if (
      promo.type === PromoType.FLASH &&
      promo.flashStock !== null &&
      promo.flashStock <= 0
    ) {
      throw new BadRequestException(
        `Le stock de la vente flash "${promo.code}" est épuisé.`,
      );
    }

    // ── Vérification 6 : Limite par client ───────────────────────────────
    if (dto.clientId && promo.maxParClient > 0) {
      const clientUses = await this.promoUsageRepo.count({
        where: {
          promotionId: promo.id,
          clientId:    dto.clientId,
        },
      });

      if (clientUses >= promo.maxParClient) {
        throw new BadRequestException(
          `Vous avez déjà utilisé le code "${promo.code}" ` +
          `${clientUses} fois (maximum : ${promo.maxParClient}).`,
        );
      }
    }

    // ── Vérification 7 : Montant minimum du panier ───────────────────────
    const montantMin = Number(promo.montantMinimum) || 0;
    if (montantMin > 0 && dto.cartTotal < montantMin) {
      throw new BadRequestException(
        `Le code "${promo.code}" est valide à partir de ` +
        `${montantMin.toLocaleString('fr-FR')} GNF. ` +
        `Votre panier : ${dto.cartTotal.toLocaleString('fr-FR')} GNF.`,
      );
    }

    // ── Vérification 8 : Scope = products → produit dans le panier ───────
    if (promo.scope === PromoScope.PRODUCTS) {
      const targetedIds = (promo.produits ?? []).map(pp => pp.productId);

      if (targetedIds.length === 0) {
        throw new BadRequestException(
          `Le code "${promo.code}" n'est associé à aucun produit.`,
        );
      }

      const cartProductIds = dto.productIds ?? [];
      const hasMatch = cartProductIds.some(id => targetedIds.includes(id));

      if (!hasMatch) {
        throw new BadRequestException(
          `Le code "${promo.code}" ne s'applique pas aux produits de votre panier.`,
        );
      }
    }

    // ── Calcul de la réduction ────────────────────────────────────────────
    const discount    = this.calculateDiscount(promo, dto.cartTotal);
    const newTotal    = Math.max(0, dto.cartTotal - discount);
    const freeShipping = promo.type === PromoType.FREE_SHIP ||
                         promo.valueType === PromoValueType.FREE;
    const label        = this.buildLabel(promo, discount);

    this.logger.log(
      `[VALIDATE CODE ✅] Code=${promo.code} | Remise=${discount} GNF | Client=${dto.clientId ?? 'anonyme'}`,
    );

    return {
      valid: true,
      discount,
      newTotal,
      freeShipping,
      label,
      promo: {
        id:        promo.id,
        nom:       promo.nom,
        code:      promo.code,
        type:      promo.type,
        scope:     promo.scope,
        valeur:    promo.valeur,
        valueType: promo.valueType,
      },
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. APPLY CODE — appelé par CommandesService après confirmation
  //
  // Enregistre l'utilisation d'un code promo après validation de la commande.
  // Effectué dans une transaction atomique :
  //   Étape 1 : Créer PromotionUsage
  //   Étape 2 : Incrémenter usesCount dans promotions
  //   Étape 3 : Mettre à jour caGenere (CA généré par la promo)
  //   Étape 4 : Décrémenter flashStock si type = flash
  //   Étape 5 : Passer status = ENDED si maxUtilisations atteint
  //
  // NE PAS RE-VALIDER ICI (validé avant par validateCode).
  // ══════════════════════════════════════════════════════════════════════════

  async applyCode(params: {
    promotionId:    string;
    clientId:       string;
    orderId:        string;
    montantReduit:  number;   // montant réellement déduit de la commande
    orderTotal:     number;   // montant total de la commande (pour caGenere)
  }): Promise<void> {

    const {
      promotionId,
      clientId,
      orderId,
      montantReduit,
      orderTotal,
    } = params;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {

      // Étape 1 — Créer l'entrée PromotionUsage
      const usage = this.promoUsageRepo.create({
        promotionId,
        clientId,
        orderId,
        montantReduit,
      });
      await qr.manager.save(PromotionUsage, usage);

      // Étape 2 — Incrémenter usesCount
      await qr.manager
        .createQueryBuilder()
        .update(Promotion)
        .set({ usesCount: () => 'usesCount + 1' })
        .where('id = :id', { id: promotionId })
        .execute();

      // Étape 3 — Mettre à jour caGenere
      await qr.manager
        .createQueryBuilder()
        .update(Promotion)
        .set({ caGenere: () => `caGenere + ${orderTotal}` })
        .where('id = :id', { id: promotionId })
        .execute();

      // Étape 4 — Décrémenter flashStock si type = flash
      await qr.manager
        .createQueryBuilder()
        .update(Promotion)
        .set({ flashStock: () => 'GREATEST(0, flashStock - 1)' })
        .where('id = :id AND type = :flash AND flashStock IS NOT NULL', {
          id:    promotionId,
          flash: PromoType.FLASH,
        })
        .execute();

      // Étape 5 — Passer status = ENDED si maxUtilisations atteint
      // ou si flashStock = 0
      await qr.manager
        .createQueryBuilder()
        .update(Promotion)
        .set({ status: PromoStatus.ENDED })
        .where('id = :id', { id: promotionId })
        .andWhere(
          '(maxUtilisations IS NOT NULL AND usesCount >= maxUtilisations) ' +
          'OR (type = :flash AND flashStock IS NOT NULL AND flashStock <= 0)',
          { flash: PromoType.FLASH },
        )
        .execute();

      await qr.commitTransaction();

      this.logger.log(
        `[APPLY CODE ✅] PromoID=${promotionId} | ClientID=${clientId} | ` +
        `OrderID=${orderId} | Remise=${montantReduit} GNF`,
      );

    } catch (err) {
      await qr.rollbackTransaction();
      this.logger.error(
        `[APPLY CODE ❌] PromoID=${promotionId} | ${(err as Error).message}`,
      );
      throw err;
    } finally {
      await qr.release();
    }
  }
}