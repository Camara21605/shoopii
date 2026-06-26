/* ============================================================
 * FICHIER : src/modules/dashboard/client/services/favoris.service.ts
 *
 * RÔLE : Gestion des produits favoris (❤️) d'un client.
 *   - toggle()   → like / unlike (table product_likes)
 *   - getAll()   → liste des produits favoris du client
 *   - getLikedIds() → IDs des produits likés (état du cœur)
 *
 * Les compteurs dénormalisés Product.likesCount et
 * Client.totalFavorites sont mis à jour à chaque toggle.
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductLike } from '../../../../database/entities/entreprise.table/product-like.entity';
import { Product }      from '../../../../database/entities/entreprise.table/product.entity';
import { Client }       from '../../../../database/entities/profiles/client-profile.entity';
import { User }         from '../../../../database/entities/user.entity';

@Injectable()
export class FavorisService {
  constructor(
    @InjectRepository(ProductLike)
    private readonly likeRepo: Repository<ProductLike>,

    @InjectRepository(Product)
    private readonly produitRepo: Repository<Product>,

    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  private async getClient(user: User): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { userId: user.id } });
    if (!client) throw new NotFoundException('Profil client introuvable.');
    return client;
  }

  /* ════════════════════════════════════════════════════════
   * POST /client/favoris/:productId/toggle
   ════════════════════════════════════════════════════════ */
  async toggle(user: User, productId: string) {
    const client = await this.getClient(user);

    const produit = await this.produitRepo.findOne({ where: { id: productId } });
    if (!produit) throw new NotFoundException('Produit introuvable.');

    const existing = await this.likeRepo.findOne({ where: { clientId: client.id, productId } });

    let liked: boolean;
    if (existing) {
      await this.likeRepo.remove(existing);
      produit.likesCount    = Math.max(0, (produit.likesCount ?? 0) - 1);
      client.totalFavorites = Math.max(0, (client.totalFavorites ?? 0) - 1);
      liked = false;
    } else {
      await this.likeRepo.save(this.likeRepo.create({ clientId: client.id, productId }));
      produit.likesCount    = (produit.likesCount ?? 0) + 1;
      client.totalFavorites = (client.totalFavorites ?? 0) + 1;
      liked = true;
    }

    await this.produitRepo.save(produit);
    await this.clientRepo.save(client);

    return { liked, likesCount: produit.likesCount };
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris
   ════════════════════════════════════════════════════════ */
  async getAll(user: User) {
    const client = await this.getClient(user);

    const likes = await this.likeRepo.find({
      where: { clientId: client.id },
      order: { createdAt: 'DESC' },
    });
    if (likes.length === 0) return [];

    const result = await Promise.all(
      likes.map(async like => {
        const p = await this.produitRepo.findOne({ where: { id: like.productId } });
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
      }),
    );

    return result.filter(Boolean);
  }

  /* ════════════════════════════════════════════════════════
   * GET /client/favoris/ids
   ════════════════════════════════════════════════════════ */
  async getLikedIds(user: User): Promise<string[]> {
    const client = await this.getClient(user);
    const likes = await this.likeRepo.find({ where: { clientId: client.id } });
    return likes.map(l => l.productId);
  }
}
