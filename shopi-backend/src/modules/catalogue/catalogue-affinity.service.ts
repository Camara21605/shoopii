/* ============================================================
 * FICHIER : src/modules/catalogue/catalogue-affinity.service.ts
 *
 * RÔLE : Personnalise l'ORDRE des types d'entreprise / catégories /
 * sous-catégories affichés en public (home, page type d'entreprise)
 * selon les goûts RÉELS du client connecté — likes, favoris, boutiques
 * suivies, historique de commandes (même famille de signaux que
 * ExploreService.pourVous(), pas de nouvelle table de tracking).
 *
 * Visiteur non connecté, compte sans profil client, ou
 * Client.privacySettings.perso === false → aucun signal disponible,
 * l'appelant retombe alors sur un simple mélange aléatoire (voir
 * shuffle() + resolveClientId() ci-dessous), pour que l'affichage ne
 * soit jamais figé dans le même ordre pour tout le monde.
 *
 * N'importe/ne modifie PAS CompanyTypesService/CategoriesService —
 * ceux-ci restent la source de vérité (CRUD super-admin) ; ce service
 * se contente de RÉORDONNER le résultat déjà renvoyé par eux.
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Client } from '../../database/entities/profiles/client-profile.entity';
import { ProductLike } from '../../database/entities/entreprise.table/product-like.entity';
import { WishlistItem } from '../../database/entities/entreprise.table/wishlist-item.entity';
import { Product } from '../../database/entities/entreprise.table/product.entity';
import { Company } from '../../database/entities/profiles/entreprise-profile.entity';
import { CommandeItem } from '../../database/entities/commande/commande-item.entity';
import { Follow, FollowerActorType, TargetActorType } from '../../database/entities/follow/follow.entity';

/** Combien de likes/favoris/achats récents on regarde par signal — borné,
 *  même logique que ExploreService.recentSignalProductIds. */
const SIGNAL_TAKE = 30;

type Dimension = 'companyType' | 'category' | 'subCategory';

@Injectable()
export class CatalogueAffinityService {

  constructor(
    @InjectRepository(Client)       private readonly clientRepo:   Repository<Client>,
    @InjectRepository(ProductLike)  private readonly likeRepo:     Repository<ProductLike>,
    @InjectRepository(WishlistItem) private readonly wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(Product)      private readonly productRepo:  Repository<Product>,
    @InjectRepository(Company)      private readonly companyRepo:  Repository<Company>,
    @InjectRepository(CommandeItem) private readonly commandeItemRepo: Repository<CommandeItem>,
    @InjectRepository(Follow)       private readonly followRepo:   Repository<Follow>,
  ) {}

  /** userId (JWT, peut être undefined si visiteur anonyme) → clientId
   *  utilisable pour scorer, ou null si aucun signal ne doit être calculé
   *  (anonyme, pas de profil client, ou personnalisation désactivée). */
  async resolveClientId(userId: string | undefined): Promise<string | null> {
    if (!userId) return null;
    const client = await this.clientRepo.findOne({ where: { userId }, select: ['id', 'privacySettings'] });
    if (!client) return null;
    const privacy = (client.privacySettings ?? {}) as Record<string, unknown>;
    if (privacy.perso === false) return null;
    return client.id;
  }

  /** Score par id (companyTypeId / categoryId / subCategoryId) — plus le
   *  score est élevé, plus ce type/catégorie/sous-catégorie doit remonter
   *  dans la liste affichée à CE client précis. */
  async scoreByDimension(clientId: string, dimension: Dimension): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    const bump = (id: string | null | undefined, weight: number) => {
      if (!id) return;
      scores.set(id, (scores.get(id) ?? 0) + weight);
    };

    const productIds = await this.recentProductIds(clientId);
    if (productIds.length > 0) {
      const products = await this.productRepo.find({
        where:  { id: In(productIds) },
        select: ['id', 'categoryId', 'subCategoryId', 'companyId'],
      });

      if (dimension === 'category') {
        for (const p of products) bump(p.categoryId, 3);
      } else if (dimension === 'subCategory') {
        for (const p of products) bump(p.subCategoryId, 3);
      } else {
        const companyIds = [...new Set(products.map(p => p.companyId).filter(Boolean))];
        if (companyIds.length > 0) {
          const companies = await this.companyRepo.find({ where: { id: In(companyIds) }, select: ['id', 'companyTypeId'] });
          const typeByCompany = new Map(companies.map(c => [c.id, c.companyTypeId]));
          for (const p of products) bump(typeByCompany.get(p.companyId), 3);
        }
      }
    }

    /* Signal supplémentaire propre aux types d'entreprise : les boutiques
     * que le client suit activement pèsent plus qu'un simple like/achat
     * ponctuel — c'est un engagement délibéré et durable. */
    if (dimension === 'companyType') {
      for (const typeId of await this.followedCompanyTypeIds(clientId)) bump(typeId, 4);
    }

    return scores;
  }

  /** Réordonne `items` : les éléments avec un score > 0 remontent en tête
   *  (triés par score décroissant), le reste est mélangé aléatoirement —
   *  jamais figé dans l'ordre admin (`ordre`) pour tout le monde, même
   *  sans signal exploitable pour un élément donné. */
  personalize<T>(items: T[], getId: (item: T) => string, scores: Map<string, number>): T[] {
    const withScore = items.filter(i => (scores.get(getId(i)) ?? 0) > 0);
    const rest       = items.filter(i => (scores.get(getId(i)) ?? 0) === 0);
    withScore.sort((a, b) => (scores.get(getId(b)) ?? 0) - (scores.get(getId(a)) ?? 0));
    return [...withScore, ...CatalogueAffinityService.shuffle(rest)];
  }

  /** Aucun signal exploitable (anonyme, opt-out) → mélange pur, pour que
   *  l'ordre change d'une visite à l'autre plutôt que de rester statique. */
  static shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Signaux bruts ────────────────────────────────────────────

  /** Produits likés + mis en favoris + achetés récemment — même famille
   *  de signal que ExploreService.recentSignalProductIds. */
  private async recentProductIds(clientId: string): Promise<string[]> {
    const [likes, wishlist, purchased] = await Promise.all([
      this.likeRepo.find({
        where: { clientId }, select: { productId: true },
        order: { createdAt: 'DESC' }, take: SIGNAL_TAKE,
      }),
      this.wishlistRepo.find({
        where: { clientId }, select: { productId: true },
        order: { createdAt: 'DESC' }, take: SIGNAL_TAKE,
      }),
      this.commandeItemRepo
        .createQueryBuilder('ci')
        .innerJoin('ci.commande', 'cmd')
        .where('cmd.clientId = :clientId', { clientId })
        .andWhere('ci.productId IS NOT NULL')
        .orderBy('ci.createdAt', 'DESC')
        .limit(SIGNAL_TAKE)
        .getMany(),
    ]);

    const ids = new Set<string>();
    for (const l of likes)     ids.add(l.productId);
    for (const w of wishlist)  ids.add(w.productId);
    for (const p of purchased) if (p.productId) ids.add(p.productId);
    return [...ids];
  }

  /** Types d'entreprise des boutiques suivies activement par ce client. */
  private async followedCompanyTypeIds(clientId: string): Promise<string[]> {
    const follows = await this.followRepo.find({
      where: {
        followerType: FollowerActorType.CLIENT,
        followerId:   clientId,
        targetType:   TargetActorType.COMPANY,
        isSubscribed: true,
      },
      select: ['targetId'],
    });
    if (follows.length === 0) return [];

    const companies = await this.companyRepo.find({
      where:  { id: In(follows.map(f => f.targetId)) },
      select: ['companyTypeId'],
    });
    return companies.map(c => c.companyTypeId).filter((id): id is string => !!id);
  }
}
