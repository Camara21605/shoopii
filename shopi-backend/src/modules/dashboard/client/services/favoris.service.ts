/* ============================================================
 * FICHIER : src/modules/dashboard/client/services/favoris.service.ts
 *
 * RÔLE : Gestion des produits favoris (❤️) d'un client.
 *   - toggle()      → like / unlike (table product_likes)
 *   - getAll()      → liste des produits favoris du client
 *   - getLikedIds() → IDs des produits likés (état du cœur)
 *
 * PERFORMANCES :
 *   toggle()      → 2 aller-retours DB (findOne product + findOne like en parallèle,
 *                   puis les écritures en parallèle)
 *   getAll()      → 2 queries (likes + produits via IN)
 *   getLikedIds() → 1 query  (likes avec select minimal)
 *
 *   user.actorId (JWT) = client.id → aucun SELECT clients nécessaire.
 *   Fallback DB si le JWT ne contient pas actorId (vieux token).
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { In, Repository }                from 'typeorm';

import { ProductLike } from '../../../../database/entities/entreprise.table/product-like.entity';
import { Product }     from '../../../../database/entities/entreprise.table/product.entity';
import { Client }      from '../../../../database/entities/profiles/client-profile.entity';
import { User }        from '../../../../database/entities/user.entity';
import { NotificationEventService } from '../../../notifications/events/notification-event.service';

@Injectable()
export class FavorisService {
  constructor(
    @InjectRepository(ProductLike)
    private readonly likeRepo: Repository<ProductLike>,

    @InjectRepository(Product)
    private readonly produitRepo: Repository<Product>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,

    private readonly notifEventSvc: NotificationEventService,
  ) {}

  /**
   * Extrait le clientId depuis user.actorId (JWT) ou via DB en fallback.
   * Le fallback couvre les JWT émis avant que actorId soit ajouté au payload.
   */
  private async resolveClientId(user: User): Promise<string> {
    const actorId = (user as any).actorId as string | undefined;
    if (actorId) return actorId;

    const client = await this.clientRepo.findOne({
      where:  { userId: user.id },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Profil client introuvable.');
    return client.id;
  }

  /* ════════════════════════════════════════════════════════
   * POST /client/favoris/:productId/toggle
   *
   * Aller-retour 1 (parallèle) :
   *   - findOne product  (select minimal, sans relations eager)
   *   - findOne like     (vérifie l'existence du like)
   *
   * Aller-retour 2 (parallèle) :
   *   - liked   → INSERT like + 2 UPDATE atomiques
   *   - unliked → DELETE like + 2 UPDATE atomiques GREATEST(0, x-1)
   * ════════════════════════════════════════════════════════ */
  async toggle(user: User, productId: string) {
    const clientId = await this.resolveClientId(user);

    /* Aller-retour 1 : product + vérification like en parallèle.
     * loadEagerRelations: false évite de charger media/category/specs/wholesaleTiers. */
    const [produit, existing] = await Promise.all([
      this.produitRepo.findOne({
        where:              { id: productId },
        select:             { id: true, likesCount: true, companyId: true, nom: true },
        loadEagerRelations: false,
      }),
      this.likeRepo.findOne({
        where:  { clientId, productId },
        select: { id: true },
      }),
    ]);

    if (!produit) throw new NotFoundException('Produit introuvable.');

    const liked = !existing;

    /* Aller-retour 2 : écritures parallèles */
    if (liked) {
      await Promise.all([
        this.likeRepo.insert({ clientId, productId }),
        this.produitRepo.update(productId, { likesCount:     () => '"likesCount" + 1'      } as any),
        this.clientRepo.update(clientId,   { totalFavorites: () => '"totalFavorites" + 1'  } as any),
      ]);
    } else {
      await Promise.all([
        this.likeRepo.delete({ clientId, productId }),
        this.produitRepo.update(productId, { likesCount:     () => 'GREATEST(0, "likesCount" - 1)'      } as any),
        this.clientRepo.update(clientId,   { totalFavorites: () => 'GREATEST(0, "totalFavorites" - 1)'  } as any),
      ]);
    }

    const newLikesCount = liked
      ? (produit.likesCount ?? 0) + 1
      : Math.max(0, (produit.likesCount ?? 0) - 1);

    if (liked) {
      void this.notifEventSvc.notifyProductLiked({
        companyId:   produit.companyId,
        productId:   produit.id,
        productName: produit.nom,
        clientId,
      });
    }

    return { liked, likesCount: newLikesCount };
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris
   *
   * 2 queries : find likes → findBy produits (IN)
   * media et category sont eager:true → chargés automatiquement.
   * ════════════════════════════════════════════════════════ */
  async getAll(user: User) {
    const clientId = await this.resolveClientId(user);

    const likes = await this.likeRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
    if (likes.length === 0) return [];

    const produits = await this.produitRepo.findBy({
      id: In(likes.map(l => l.productId)),
    });
    const productMap = new Map(produits.map(p => [p.id, p]));

    return likes
      .map(like => {
        const p = productMap.get(like.productId);
        if (!p) return null;

        const images = (p.media ?? []).slice().sort((a, b) => a.ordre - b.ordre);
        return {
          id:         like.id,
          productId:  p.id,
          nom:        p.nom,
          prix:       p.prix,
          prixAncien: p.prixAncien,
          emoji:      p.category?.icone ?? '📦',
          imageUrl:   images[0]?.url ?? null,
        };
      })
      .filter(Boolean);
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris/ids
   *
   * 1 query : select minimal sur product_likes uniquement.
   * ════════════════════════════════════════════════════════ */
  async getLikedIds(user: User): Promise<string[]> {
    const clientId = await this.resolveClientId(user);
    const likes = await this.likeRepo.find({
      where:  { clientId },
      select: { productId: true },
    });
    return likes.map(l => l.productId);
  }
}
