/* ============================================================
 * FICHIER  : src/modules/geo/geo-resolution.service.ts
 * ROLE     : Résout les références géographiques STRUCTURÉES
 *            (paysId/villeId) des acteurs (Partner/Company/Delivery)
 *            à partir de leurs champs texte libre (ville/pays) — une
 *            fois, en écriture (peuplement des colonnes), jamais en
 *            lecture.
 *
 * POURQUOI :
 *   Partner.ville/pays, Company.ville/pays, Delivery.ville sont du
 *   texte libre saisi par l'acteur — pas de FK vers le référentiel
 *   geo_prefectures/geo_pays. Impossible de filtrer fiablement "tous
 *   les acteurs de telle préfecture/pays" dessus.
 *
 *   La "communauté" support assignée à un admin (Admin.paysAssigne /
 *   villeAssignee / zoneId — voir admin-profile.entity.ts) doit
 *   pouvoir filtrer les tickets par appartenance géographique réelle,
 *   pas par correspondance de texte recalculée à chaque requête. Ce
 *   service peuple donc UNE FOIS les colonnes structurées paysId/
 *   villeId de chaque acteur (résolution ville → préfecture par nom,
 *   puis remontée préfecture → région → pays via parentId), et
 *   SupportPermissionService ne fait plus ensuite que des égalités
 *   simples sur ces colonnes.
 *
 * DÉCLENCHEMENT :
 *   - POST /geo/resolve-actors (super-admin) — recalcul complet à la
 *     demande, voir geo.controller.ts.
 *   - Devrait idéalement aussi tourner à la création/mise à jour du
 *     profil d'un acteur (hors scope de ce chantier — les points
 *     d'entrée de création sont nombreux et dispersés ; le recalcul
 *     manuel couvre le besoin immédiat, un déclenchement automatique
 *     pourra être ajouté plus tard sans changer cette API).
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, IsNull, Not, Repository } from 'typeorm';

import { GeoPays }       from '../../database/entities/geo/geo-pays.entity';
import { GeoRegion }     from '../../database/entities/geo/geo-region.entity';
import { GeoPrefecture } from '../../database/entities/geo/geo-prefecture.entity';
import { Partner }  from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }  from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery } from '../../database/entities/profiles/livreur-profile.entity';

export interface ResolvedGeoIds {
  paysId:  string | null;
  villeId: string | null;
}

export interface RecomputeResult {
  partners:   { total: number; resolved: number };
  companies:  { total: number; resolved: number };
  deliveries: { total: number; resolved: number };
}

@Injectable()
export class GeoResolutionService {
  private readonly logger = new Logger(GeoResolutionService.name);

  constructor(
    @InjectRepository(GeoPays)       private readonly paysRepo:   Repository<GeoPays>,
    @InjectRepository(GeoRegion)     private readonly regionRepo: Repository<GeoRegion>,
    @InjectRepository(GeoPrefecture) private readonly prefRepo:   Repository<GeoPrefecture>,
    @InjectRepository(Partner)  private readonly partnerRepo:  Repository<Partner>,
    @InjectRepository(Company)  private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery) private readonly deliveryRepo: Repository<Delivery>,
  ) {}

  /**
   * Résout paysId/villeId à partir des champs texte libre d'un acteur.
   *
   * Stratégie villeId : correspondance exacte (insensible à la casse)
   * du nom de préfecture. Stratégie paysId : déduit en priorité de la
   * préfecture résolue (préfecture.parentId → région, région.parentId
   * → pays) — bien plus fiable que le champ texte `pays` (souvent un
   * code ISO-2 comme "GN" qui ne correspond directement ni au code ni
   * au nom stockés dans geo_pays). Le champ texte `pays` n'est utilisé
   * qu'en dernier recours, si la ville n'a pas pu être résolue.
   */
  async resolveGeoIds(villeText: string | null, paysText?: string | null): Promise<ResolvedGeoIds> {
    let villeId: string | null = null;
    let paysId:  string | null = null;

    const ville = villeText?.trim();
    if (ville) {
      const pref = await this.prefRepo.findOne({ where: { nom: ILike(ville) } });
      if (pref) {
        villeId = pref.id;
        if (pref.parentId) {
          const region = await this.regionRepo.findOne({ where: { id: pref.parentId } });
          if (region?.parentId) paysId = region.parentId;
        }
      }
    }

    if (!paysId) {
      const pays = paysText?.trim();
      if (pays) {
        const found = await this.paysRepo.findOne({
          where: [{ code: ILike(pays) }, { nom: ILike(pays) }, { iso3: ILike(pays) }],
        });
        if (found) paysId = found.id;
      }
    }

    return { paysId, villeId };
  }

  /**
   * Recalcule paysId/villeId pour TOUS les partenaires, entreprises et
   * livreurs — idempotent, sûr à relancer (ex: après import/correction
   * du référentiel géographique). Ne touche jamais aux champs texte
   * d'origine (ville/pays), uniquement aux colonnes structurées.
   */
  async recomputeAllActors(): Promise<RecomputeResult> {
    const partners = await this.partnerRepo.find({ select: ['id', 'ville', 'pays'] });
    let partnersResolved = 0;
    for (const p of partners) {
      const { paysId, villeId } = await this.resolveGeoIds(p.ville, p.pays);
      if (paysId || villeId) partnersResolved++;
      await this.partnerRepo.update(p.id, { paysId, villeId });
    }

    const companies = await this.companyRepo.find({ select: ['id', 'ville', 'pays'] });
    let companiesResolved = 0;
    for (const c of companies) {
      const { paysId, villeId } = await this.resolveGeoIds(c.ville, c.pays);
      if (paysId || villeId) companiesResolved++;
      await this.companyRepo.update(c.id, { paysId, villeId });
    }

    const deliveries = await this.deliveryRepo.find({ select: ['id', 'ville'] });
    let deliveriesResolved = 0;
    for (const d of deliveries) {
      const { paysId, villeId } = await this.resolveGeoIds(d.ville, null);
      if (paysId || villeId) deliveriesResolved++;
      await this.deliveryRepo.update(d.id, { paysId, villeId });
    }

    this.logger.log(
      `[GeoResolution] partners=${partnersResolved}/${partners.length} `
      + `companies=${companiesResolved}/${companies.length} `
      + `deliveries=${deliveriesResolved}/${deliveries.length}`,
    );

    return {
      partners:   { total: partners.length,   resolved: partnersResolved },
      companies:  { total: companies.length,  resolved: companiesResolved },
      deliveries: { total: deliveries.length, resolved: deliveriesResolved },
    };
  }

  /* Marqueurs pratiques pour l'UI (nombre d'acteurs pas encore résolus,
   * avant de lancer le recalcul) — voir GET /geo/resolve-actors/status. */
  async getUnresolvedCounts(): Promise<{ partners: number; companies: number; deliveries: number }> {
    const [partners, companies, deliveries] = await Promise.all([
      this.partnerRepo.count({ where: { villeId: IsNull(), ville: Not(IsNull()) } }),
      this.companyRepo.count({ where: { villeId: IsNull(), ville: Not(IsNull()) } }),
      this.deliveryRepo.count({ where: { villeId: IsNull(), ville: Not(IsNull()) } }),
    ]);
    return { partners, companies, deliveries };
  }
}
