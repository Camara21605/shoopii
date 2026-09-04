/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/services/livraison-parametres.service.ts
 *
 * RÔLE : Gère les méthodes et zones de livraison (section 5)
 *   PATCH /parametres/livraison → toggles méthodes + zones JSON
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Company } from 'src/database/entities/profiles/entreprise-profile.entity';
import { Admin } from 'src/database/entities/profiles/admin-profile.entity';
import { GeoZone } from 'src/database/entities/geo/geo-zone.entity';
import { GeoCommune } from 'src/database/entities/geo/geo-commune.entity';
import { UpdateLivraisonDto } from '../dto/update-livraison.dto';
import { PublicBroadcastService } from 'src/modules/public/public-broadcast.service';

@Injectable()
export class LivraisonParametresService {

  private readonly logger = new Logger(LivraisonParametresService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(GeoZone)
    private readonly zoneRepo: Repository<GeoZone>,

    @InjectRepository(GeoCommune)
    private readonly communeRepo: Repository<GeoCommune>,

    /* Diffuse en direct aux visiteurs actuellement sur la fiche boutique
     * publique — même mécanisme que Horaires/Catalogue, voir
     * public/public.gateway.ts. */
    private readonly publicBroadcast: PublicBroadcastService,
  ) {}

  /* ──────────────────────────────────────────────────────────
   * PATCH — Mettre à jour les méthodes et zones (section 5)
   * ────────────────────────────────────────────────────────── */

  async updateLivraison(userId: string, dto: UpdateLivraisonDto): Promise<Company> {
    const company = await this.findCompanyOrFail(userId);

    if (dto.livraisonStandard !== undefined) company.livraisonStandard = dto.livraisonStandard;
    if (dto.livraisonShopi    !== undefined) company.livraisonShopi    = dto.livraisonShopi;
    if (dto.livraisonCorresp  !== undefined) company.livraisonCorresp  = dto.livraisonCorresp;
    if (dto.clickCollect      !== undefined) company.clickCollect      = dto.clickCollect;
    if (dto.livraisonExpress  !== undefined) company.livraisonExpress  = dto.livraisonExpress;
    if (dto.zonesLivraison    !== undefined) company.zonesLivraison    = dto.zonesLivraison;

    const updated = await this.companyRepo.save(company);
    this.logger.log(`[LIVRAISON] Mis à jour — userId=${userId}`);

    /* BUG CORRIGÉ — méthodes/zones affichées sur la fiche boutique
     * (Infos pratiques > Livraison) ne se mettaient jamais à jour en
     * direct pour qui la consultait déjà. Même mécanisme que
     * boutique:catalogue_updated. */
    this.publicBroadcast.emitToBoutique(company.id, 'boutique:livraison_updated', {});

    return updated;
  }

  /* ──────────────────────────────────────────────────────────
   * GET — Zones de livraison disponibles (section 5)
   *
   * BUG CORRIGÉ — la liste de zones proposée dans le sélecteur venait
   * d'un fichier statique (geo-guinee.ts) sans aucun rapport avec le
   * référentiel géographique réellement géré par les super-admins/admins
   * (GeoZone). On résout maintenant la VRAIE zone attribuée à cette
   * entreprise : Company.adminId → Admin assigné → Admin.zoneId (ou
   * Admin.zone en repli texte) → GeoZone → ses communes couvertes
   * (GeoZone.couvertureIds). Même logique de résolution que
   * ZoneAdminService.resolveZone()/getMyZone() côté admin — voir
   * zone-admin/zone-admin.service.ts.
   *
   * Si l'entreprise n'a pas d'admin assigné (adminId null) ou que
   * l'admin n'a pas de zone assignée, on renvoie une liste vide plutôt
   * qu'un repli arbitraire : l'entreprise doit voir exactement ce qui
   * lui a été attribué, rien de plus.
   * ────────────────────────────────────────────────────────── */
  async getZonesDisponibles(userId: string) {
    const company = await this.findCompanyOrFail(userId);

    if (!company.adminId) {
      return { zoneId: null, zoneNom: null, communes: [] as { id: string; nom: string; code: string }[] };
    }

    const admin = await this.adminRepo.findOne({ where: { id: company.adminId } });
    if (!admin) {
      return { zoneId: null, zoneNom: null, communes: [] as { id: string; nom: string; code: string }[] };
    }

    const zone = await this.resolveZone(admin);
    if (!zone?.couvertureIds?.length) {
      return { zoneId: zone?.id ?? null, zoneNom: zone?.nom ?? null, communes: [] as { id: string; nom: string; code: string }[] };
    }

    const rows = await this.communeRepo.find({
      where: { id: In(zone.couvertureIds) },
      select: { id: true, nom: true, code: true } as any,
    });

    return {
      zoneId:  zone.id,
      zoneNom: zone.nom,
      communes: rows.map(c => ({ id: c.id, nom: c.nom, code: c.code })),
    };
  }

  /* ── HELPER — résout la GeoZone assignée à un admin (identique à
   * ZoneAdminService.resolveZone) ── */
  private async resolveZone(admin: Admin): Promise<GeoZone | null> {
    if (admin.zoneId) {
      const z = await this.zoneRepo.findOne({ where: { id: admin.zoneId } });
      if (z) return z;
    }
    if (admin.zone) {
      return this.zoneRepo.findOne({ where: { nom: admin.zone } }) ?? null;
    }
    return null;
  }

  /* ── HELPER ── */
  /* FIX m4 (historique, param client) — sans rapport ici : `userId` est en
   * réalité req.user.actorId, signé serveur (voir boutique-parametres.
   * service.ts pour le détail du bug que ce `[{id},{userId}]` corrige). */
  /* BUG CORRIGÉ — l'ancien `where:[{id},{userId}]` était un OR SQL sans
   * ordre garanti : quand une AUTRE entreprise a par accident un userId
   * identique à l'id de celle-ci (bug de profil fantôme, voir getParametres
   * dans boutique-parametres.service.ts), Postgres pouvait retourner l'une
   * ou l'autre selon le plan de requête — a réellement fait persister des
   * réglages sur la mauvaise fiche. `id` (cas normal, actorId) est
   * désormais toujours tenté en priorité ; `userId` n'est qu'un repli. */
  private async findCompanyOrFail(userId: string): Promise<Company> {
    let company = await this.companyRepo.findOne({ where: { id: userId } });
    if (!company) company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');
    return company;
  }
}
