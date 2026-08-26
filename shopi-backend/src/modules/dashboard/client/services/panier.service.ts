/* ============================================================
 * FICHIER : src/modules/dashboard/client/services/panier.service.ts
 *
 * PanierItem.produit est eager (@ManyToOne eager:true) : chaque
 * lecture du panier ramène le produit en une seule requête via JOIN.
 * Product.media / Product.category ne sont plus eager (voir
 * product.entity.ts) — on les déclare donc explicitement ci-dessous
 * (relations: ['produit.media', 'produit.category']) uniquement
 * dans getAll(), le seul endroit qui affiche image + emoji catégorie.
 * ============================================================ */

import {
  BadRequestException, Injectable,
  Logger, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { PanierItem } from '../../../../database/entities/panier-item.entity';
import { Product }    from '../../../../database/entities/entreprise.table/product.entity';
import { User }       from '../../../../database/entities/user.entity';

export interface AddToCartDto {
  produitId: string;
  qty?:      number;
  variante?: string;
}

/* ── Lecture défensive des champs Product ── */
function readProduct(p: any) {
  /* Nom du produit — conventions fr / en */
  const nom = p.nom ?? p.name ?? p.title ?? 'Produit';

  /* Prix — plusieurs conventions possibles */
  const prix = p.prix ?? p.price ?? p.unitPrice ?? 0;

  /* Ancien prix */
  const prixAncien = p.prixAncien ?? p.oldPrice ?? p.compareAtPrice ?? null;

  /* Stock */
  const stock = p.stock ?? p.stockQuantity ?? p.quantity ?? 99;

  /* Image — tente plusieurs noms de relation */
  let imageUrl: string | null = null;
  const medias: any[] =
    p.medias        ??   // ProductMedia (nouveau nom)
    p.images        ??   // ancien nom
    p.productMedias ??   // autre convention
    p.photos        ??   // autre convention
    [];
  if (medias.length > 0) {
    const sorted = [...medias].sort((a, b) => (a.ordre ?? a.order ?? 0) - (b.ordre ?? b.order ?? 0));
    imageUrl = sorted[0]?.url ?? sorted[0]?.imageUrl ?? null;
  }

  /* Emoji catégorie */
  const emoji = p.category?.icone ?? p.categorie?.icone ?? '📦';

  /* Boutique */
  const companyId   = p.companyId ?? '';
  const companyName = p.company?.companyName ?? p.boutique?.nom ?? 'Boutique';

  return { nom, prix, prixAncien, stock, imageUrl, emoji, companyId, companyName };
}

@Injectable()
export class PanierService {
  private readonly logger = new Logger(PanierService.name);

  constructor(
    @InjectRepository(PanierItem)
    private readonly panierRepo: Repository<PanierItem>,

    @InjectRepository(Product)
    private readonly produitRepo: Repository<Product>,
  ) {}

  /* ════════════════════════════════════════════════════════
   * GET /client/panier
   *
   * 1 seule requête : PanierItem.produit est @ManyToOne(eager:true),
   * donc panierRepo.find() ramène déjà chaque produit via LEFT JOIN.
   * media/category déclarés explicitement (non eager côté Product).
   * Avant : jusqu'à 3 requêtes DB supplémentaires PAR article
   * (retry sur des noms de relation 'medias'/'images' inexistants
   * sur Product — la vraie relation s'appelle 'media').
   ════════════════════════════════════════════════════════ */
  async getAll(user: User) {
    const items = await this.panierRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'ASC' },
      relations: ['produit', 'produit.media', 'produit.category'],
    });

    return items
      .map(item => {
        if (!item.produit) return null;

        const info = readProduct(item.produit);
        return {
          id:         item.id,
          produitId:  item.produitId,
          nom:        info.nom,
          prix:       info.prix,
          prixAncien: info.prixAncien,
          qty:        item.qty,
          variante:   item.variante ?? null,
          imageUrl:   info.imageUrl,
          emoji:      info.emoji,
          shopNom:    info.companyName,
          shopId:     info.companyId,
          stock:      info.stock,
        };
      })
      .filter(Boolean);
  }

  /* ════════════════════════════════════════════════════════
   * POST /client/panier
   ════════════════════════════════════════════════════════ */
  async add(user: User, dto: AddToCartDto) {
    const produit = await this.produitRepo.findOne({ where: { id: dto.produitId } });
    if (!produit) throw new NotFoundException('Produit introuvable.');

    const stock = (produit as any).stock ?? (produit as any).stockQuantity ?? 99;
    if (stock === 0) throw new BadRequestException('Ce produit est en rupture de stock.');

    const qty = Math.max(1, Math.min(dto.qty ?? 1, 10));

    /* Upsert : si la ligne existe → incrémenter */
    const existing = await this.panierRepo.findOne({
      where: { userId: user.id, produitId: dto.produitId },
    });

    if (existing) {
      existing.qty = Math.min(existing.qty + qty, 10, stock);
      if (dto.variante) existing.variante = dto.variante;
      await this.panierRepo.save(existing);
    } else {
      const item = this.panierRepo.create({
        userId:    user.id,
        produitId: dto.produitId,
        qty:       Math.min(qty, stock),
        variante:  dto.variante ?? null,
      } as DeepPartial<PanierItem>);
      await this.panierRepo.save(item);
    }

    this.logger.log(`[PANIER ADD] userId=${user.id} | produit=${dto.produitId} | qty=${qty}`);
    return this.getAll(user);
  }

  /* ════════════════════════════════════════════════════════
   * PATCH /client/panier/:id
   ════════════════════════════════════════════════════════ */
  async updateQty(user: User, itemId: string, qty: number) {
    const item = await this.panierRepo.findOne({ where: { id: itemId, userId: user.id } });
    if (!item) throw new NotFoundException('Article introuvable dans le panier.');
    if (qty < 1) throw new BadRequestException('Quantité doit être ≥ 1.');
    item.qty = Math.min(qty, 10);
    await this.panierRepo.save(item);
    return this.getAll(user);
  }

  /* ════════════════════════════════════════════════════════
   * DELETE /client/panier/:id
   ════════════════════════════════════════════════════════ */
  async removeItem(user: User, itemId: string) {
    const item = await this.panierRepo.findOne({ where: { id: itemId, userId: user.id } });
    if (!item) throw new NotFoundException('Article introuvable dans le panier.');
    await this.panierRepo.remove(item);
    return this.getAll(user);
  }

  /* ════════════════════════════════════════════════════════
   * DELETE /client/panier
   ════════════════════════════════════════════════════════ */
  async clear(user: User): Promise<{ message: string }> {
    await this.panierRepo.delete({ userId: user.id });
    this.logger.log(`[PANIER CLEAR] userId=${user.id}`);
    return { message: 'Panier vidé.' };
  }
}