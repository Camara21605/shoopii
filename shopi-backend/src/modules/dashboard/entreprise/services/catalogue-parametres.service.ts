/*
 * FICHIER : src/modules/dashboard/entreprise/services/catalogue-parametres.service.ts
 * ✅ CORRIGÉ : devise peut être null (venant du DTO) — on l'ignore si null
 */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { UpdateCatalogueDto } from '../dto/update-catalogue.dto';
import { PublicBroadcastService } from 'src/modules/public/public-broadcast.service';

@Injectable()
export class CatalogueParametresService {

  private readonly logger = new Logger(CatalogueParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    /* Diffuse en direct aux visiteurs actuellement sur la fiche boutique
     * publique — voir public/public.gateway.ts et HorairesParametresService
     * pour le même mécanisme appliqué aux horaires. */
    private readonly publicBroadcast: PublicBroadcastService,
  ) {}

  async updateCatalogue(userId: string, dto: UpdateCatalogueDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.showOutOfStock  !== undefined) company.showOutOfStock  = dto.showOutOfStock;
    if (dto.autoPublish     !== undefined) company.autoPublish     = dto.autoPublish;
    if (dto.showStrikePrice !== undefined) company.showStrikePrice = dto.showStrikePrice;
    if (dto.allowReviews    !== undefined) company.allowReviews    = dto.allowReviews;

    // ✅ CORRIGÉ : on n'assigne que si la valeur est une vraie string (pas null)
    if (dto.devise !== undefined && dto.devise !== null) {
      company.devise = dto.devise;
    }

    if (dto.returnPolicy    !== undefined) company.returnPolicy    = dto.returnPolicy ?? null;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[CATALOGUE] Mis à jour — userId=${userId}`);

    /* BUG CORRIGÉ — showOutOfStock/showStrikePrice/returnPolicy changent
     * ce qu'affiche la page boutique publique (filtre produits en rupture,
     * prix barré, texte de retour) mais rien ne le signalait en direct à
     * qui la consultait déjà — il fallait recharger la page à la main.
     * Contrairement aux horaires (un seul champ, poussé directement), ici
     * plusieurs surfaces sont concernées (liste de produits ET fiche
     * boutique) → on signale juste "quelque chose a changé", le frontend
     * recharge lui-même ce qu'il affiche déjà (voir BoutiquePage.tsx). */
    this.publicBroadcast.emitToBoutique(company.id, 'boutique:catalogue_updated', {});

    /* Home affiche des produits de PLUSIEURS entreprises à la fois (bloc
     * aléatoire) — impossible à cibler par une seule room boutique:{id}.
     * Diffusion globale à tous les visiteurs connectés à /public : chacun
     * ne rafraîchit que ce qu'il affiche déjà (voir RandomBloc.tsx), même
     * philosophie que boutique:catalogue_updated ci-dessus. */
    this.publicBroadcast.emitGlobal('catalogue:changed', {});

    return updated;
  }

  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli.
   * C'est probablement CE bug précis qui a fait qu'un décochage de
   * "Afficher les prix barrés" ne se répercutait jamais sur Home : le
   * PATCH atterrissait au hasard sur une fiche entreprise fantôme sans
   * aucun produit public. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}