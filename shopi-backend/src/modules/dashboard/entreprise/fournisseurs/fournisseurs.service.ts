/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/fournisseurs/fournisseurs.service.ts
 * RÔLE    : Connexion d'une entreprise Shopi à une autre entreprise
 *           Shopi vendant en gros, pour accéder à son catalogue de
 *           réapprovisionnement (action "Synchroniser le stock" de
 *           la page Inventaire).
 *
 * Pas d'intégration API tierce (Alibaba, Amazon…) — le "fournisseur"
 * est ici une autre entreprise déjà présente sur la plateforme.
 * ============================================================ */

import {
  Injectable, NotFoundException, BadRequestException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CompanySupplierLink } from 'src/database/entities/entreprise.table/company-supplier-link.entity';
import { Company, CompanyStatus } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Product, ProductVisibility } from 'src/database/entities/entreprise.table/product.entity';
import { User } from 'src/database/entities/user.entity';

export interface FournisseurCandidate {
  id:                string;
  nom:               string;
  logo:              string | null;
  description:       string | null;
  produitsGrosCount: number;
  dejaConnecte:      boolean;
}

export interface FournisseurResponse {
  linkId:            string;
  companyId:         string;
  nom:               string;
  logo:              string | null;
  description:       string | null;
  produitsGrosCount: number;
  connecteLe:        string;
}

export interface CatalogueProduitResponse {
  id:              string;
  nom:             string;
  prix:            number;
  moq:             number | null;
  conditionnement: number | null;
  image:           string | null;
  wholesaleTiers:  { quantiteMin: number; quantiteMax: number | null; prixUnitaire: number }[];
}

@Injectable()
export class FournisseursService {

  constructor(
    @InjectRepository(CompanySupplierLink) private readonly linkRepo:    Repository<CompanySupplierLink>,
    @InjectRepository(Company)             private readonly companyRepo: Repository<Company>,
    @InjectRepository(Product)             private readonly productRepo: Repository<Product>,
  ) {}

  // ── Recherche d'entreprises Shopi vendant en gros ───────────────
  async rechercher(user: User, search?: string): Promise<FournisseurCandidate[]> {
    const myCompanyId = await this.resolveCompanyId(user);

    const qb = this.companyRepo.createQueryBuilder('c')
      .innerJoin('c.products', 'p', 'p.venteEnGros = true AND p.visibilite = :vis', { vis: ProductVisibility.PUBLIC })
      .where('c.id != :myId',      { myId: myCompanyId })
      .andWhere('c.status = :status', { status: CompanyStatus.ACTIVE })
      .select(['c.id', 'c.companyName', 'c.logo', 'c.description'])
      .addSelect('COUNT(DISTINCT p.id)', 'produitsGrosCount')
      .groupBy('c.id')
      .orderBy('c.companyName', 'ASC')
      .limit(30);

    if (search?.trim()) {
      qb.andWhere('c.companyName ILIKE :search', { search: `%${search.trim()}%` });
    }

    const { entities, raw } = await qb.getRawAndEntities();

    const existingLinks  = await this.linkRepo.find({ where: { buyerCompanyId: myCompanyId } });
    const connectedIds   = new Set(existingLinks.map(l => l.supplierCompanyId));

    return entities.map((c, i) => ({
      id:                c.id,
      nom:               c.companyName,
      logo:              c.logo,
      description:       c.description,
      produitsGrosCount: parseInt(raw[i].produitsGrosCount, 10) || 0,
      dejaConnecte:      connectedIds.has(c.id),
    }));
  }

  // ── Connexion à un fournisseur ──────────────────────────────────
  async connecter(user: User, supplierCompanyId: string): Promise<FournisseurResponse> {
    const myCompanyId = await this.resolveCompanyId(user);

    if (supplierCompanyId === myCompanyId) {
      throw new BadRequestException('Une entreprise ne peut pas se connecter à elle-même.');
    }

    const supplier = await this.companyRepo.findOne({ where: { id: supplierCompanyId } });
    if (!supplier) throw new NotFoundException('Entreprise introuvable.');

    const grosCount = await this.productRepo.count({
      where: { companyId: supplierCompanyId, venteEnGros: true, visibilite: ProductVisibility.PUBLIC },
    });
    if (grosCount === 0) {
      throw new BadRequestException('Cette entreprise ne propose pas de vente en gros pour le moment.');
    }

    const already = await this.linkRepo.findOne({ where: { buyerCompanyId: myCompanyId, supplierCompanyId } });
    if (already) throw new ConflictException('Ce fournisseur est déjà connecté.');

    const link = this.linkRepo.create({ buyerCompanyId: myCompanyId, supplierCompanyId });
    await this.linkRepo.save(link);

    return this.toFournisseurResponse(link, supplier, grosCount);
  }

  // ── Liste des fournisseurs connectés ────────────────────────────
  async mesFournisseurs(user: User): Promise<FournisseurResponse[]> {
    const myCompanyId = await this.resolveCompanyId(user);

    const links = await this.linkRepo.find({
      where:     { buyerCompanyId: myCompanyId },
      relations: ['supplierCompany'],
      order:     { createdAt: 'DESC' },
    });

    return Promise.all(links.map(async l => {
      const grosCount = await this.productRepo.count({
        where: { companyId: l.supplierCompanyId, venteEnGros: true, visibilite: ProductVisibility.PUBLIC },
      });
      return this.toFournisseurResponse(l, l.supplierCompany, grosCount);
    }));
  }

  // ── Déconnexion d'un fournisseur ────────────────────────────────
  async deconnecter(user: User, linkId: string): Promise<void> {
    const myCompanyId = await this.resolveCompanyId(user);
    const link = await this.linkRepo.findOne({ where: { id: linkId, buyerCompanyId: myCompanyId } });
    if (!link) throw new NotFoundException('Connexion fournisseur introuvable.');
    await this.linkRepo.remove(link);
  }

  // ── Catalogue de vente en gros d'un fournisseur connecté ────────
  async catalogue(user: User, supplierCompanyId: string): Promise<CatalogueProduitResponse[]> {
    const myCompanyId = await this.resolveCompanyId(user);

    const link = await this.linkRepo.findOne({ where: { buyerCompanyId: myCompanyId, supplierCompanyId } });
    if (!link) throw new ForbiddenException("Connectez-vous d'abord à ce fournisseur pour voir son catalogue.");

    const produits = await this.productRepo.find({
      where:     { companyId: supplierCompanyId, venteEnGros: true, visibilite: ProductVisibility.PUBLIC },
      relations: ['media', 'wholesaleTiers'],
      order:     { createdAt: 'DESC' },
    });

    return produits.map(p => ({
      id:              p.id,
      nom:             p.nom,
      prix:            p.prix,
      moq:             p.moq,
      conditionnement: p.conditionnement,
      image:           p.media?.[0]?.url ?? null,
      wholesaleTiers:  (p.wholesaleTiers ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(t => ({ quantiteMin: t.quantiteMin, quantiteMax: t.quantiteMax, prixUnitaire: t.prixUnitaire })),
    }));
  }

  // ── PRIVÉES ──────────────────────────────────────────────────────

  private async resolveCompanyId(user: User): Promise<string> {
    const companyProfile = await this.companyRepo.findOne({ where: { userId: user.id } });
    if (!companyProfile) throw new NotFoundException('Profil entreprise introuvable.');
    return companyProfile.id;
  }

  private toFournisseurResponse(link: CompanySupplierLink, company: Company, produitsGrosCount: number): FournisseurResponse {
    return {
      linkId:            link.id,
      companyId:         company.id,
      nom:               company.companyName,
      logo:              company.logo,
      description:       company.description,
      produitsGrosCount,
      connecteLe:        link.createdAt.toISOString(),
    };
  }
}
