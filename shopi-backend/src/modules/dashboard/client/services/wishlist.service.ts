/* ============================================================
 * FICHIER : src/modules/dashboard/client/services/wishlist.service.ts
 *
 * RÔLE : Gestion de la liste de souhaits (save-for-later) d'un client.
 *   - toggle()  → ajouter / retirer un produit (table wishlist_items)
 *   - getAll()  → liste des produits de la liste de souhaits
 *   - getIds()  → IDs des produits présents (état du bouton)
 *
 * Voir wishlist-item.entity.ts pour la distinction avec ProductLike
 * (❤️ favoris — signal public/social) que cette liste ne remplace pas.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository }              from '@nestjs/typeorm';
import { In, Repository }                from 'typeorm';

import { WishlistItem } from '../../../../database/entities/entreprise.table/wishlist-item.entity';
import { Product }      from '../../../../database/entities/entreprise.table/product.entity';
import { Client }       from '../../../../database/entities/profiles/client-profile.entity';
import { User }         from '../../../../database/entities/user.entity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistRepo: Repository<WishlistItem>,

    @InjectRepository(Product)
    private readonly produitRepo: Repository<Product>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /** Même logique que FavorisService.resolveClientId — voir ce fichier
   * pour le détail du fallback DB (vieux tokens sans actorId). */
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
   * POST /client/wishlist/:productId/toggle
   * ════════════════════════════════════════════════════════ */
  async toggle(user: User, productId: string) {
    const clientId = await this.resolveClientId(user);

    const [produit, existing] = await Promise.all([
      this.produitRepo.findOne({
        where:              { id: productId },
        select:             { id: true },
        loadEagerRelations: false,
      }),
      this.wishlistRepo.findOne({
        where:  { clientId, productId },
        select: { id: true },
      }),
    ]);

    if (!produit) throw new NotFoundException('Produit introuvable.');

    const added = !existing;
    if (added) {
      await this.wishlistRepo.insert({ clientId, productId });
    } else {
      await this.wishlistRepo.delete({ clientId, productId });
    }

    return { added };
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/wishlist
   * ════════════════════════════════════════════════════════ */
  async getAll(user: User) {
    const clientId = await this.resolveClientId(user);
    return this.getAllForClient(clientId);
  }

  /** Réutilisé par le profil public client (getAll() ci-dessus résout le
   * clientId depuis le JWT ; ici il est déjà connu de l'appelant). */
  async getAllForClient(clientId: string) {
    const items = await this.wishlistRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
    if (items.length === 0) return [];

    const produits = await this.produitRepo.find({
      where:     { id: In(items.map(i => i.productId)) },
      relations: ['media', 'category'],
    });
    const productMap = new Map(produits.map(p => [p.id, p]));

    return items
      .map(item => {
        const p = productMap.get(item.productId);
        if (!p) return null;

        const images = (p.media ?? []).slice().sort((a, b) => a.ordre - b.ordre);
        return {
          id:         item.id,
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
   * GET /client/wishlist/ids
   * ════════════════════════════════════════════════════════ */
  async getIds(user: User): Promise<string[]> {
    const clientId = await this.resolveClientId(user);
    const items = await this.wishlistRepo.find({
      where:  { clientId },
      select: { productId: true },
    });
    return items.map(i => i.productId);
  }
}
