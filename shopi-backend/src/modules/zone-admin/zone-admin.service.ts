/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.service.ts
 *
 * RÔLE : Centre de contrôle territorial de l'administrateur.
 *   - Identité de la zone (GeoZone + communes couvertes)
 *   - Statistiques des acteurs (partenaires, entreprises, livreurs)
 *   - Couverture par commune
 *   - Gestion des préférences d'alertes
 *
 * SÉCURITÉ :
 *   Un admin ne peut accéder qu'à SA zone (userId scopé).
 *   Le super-admin a accès à toutes les zones via GeoModule.
 * ================================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In }   from 'typeorm';

import { Admin }      from '../../database/entities/profiles/admin-profile.entity';
import { GeoZone }    from '../../database/entities/geo/geo-zone.entity';
import { GeoCommune } from '../../database/entities/geo/geo-commune.entity';
import { Partner }    from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }    from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }   from '../../database/entities/profiles/livreur-profile.entity';

import { UpdateAlertPreferencesDto } from './zone-admin.dto';

/* ── Préférences d'alertes par défaut ────────────────────────── */
const DEFAULT_ALERT_PREFS: Record<string, boolean> = {
  grave:               true,
  validation:          true,
  litige:              false,
  nouvelleEntreprise:  false,
  nouveauPartenaire:   false,
  nouveauLivreur:      false,
  commandeImportante:  false,
  hausseInhabituelle:  false,
  baisseVentes:        false,
  signalementCritique: true,
  paiementEchoue:      false,
  livreurInactif:      false,
  tentativeFraude:     true,
};

/* ================================================================
 * SERVICE
 * ================================================================ */
@Injectable()
export class ZoneAdminService {

  private readonly logger = new Logger(ZoneAdminService.name);

  constructor(
    @InjectRepository(Admin)      private readonly adminRepo:    Repository<Admin>,
    @InjectRepository(GeoZone)    private readonly zoneRepo:     Repository<GeoZone>,
    @InjectRepository(GeoCommune) private readonly communeRepo:  Repository<GeoCommune>,
    @InjectRepository(Partner)    private readonly partnerRepo:  Repository<Partner>,
    @InjectRepository(Company)    private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)   private readonly deliveryRepo: Repository<Delivery>,
  ) {}

  /* ── Helper : récupère l'admin ou lève 404 ──────────────────── */
  private async requireAdmin(userId: string): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) throw new NotFoundException('Administrateur introuvable.');
    return admin;
  }

  /* ── Helper : résout la GeoZone assignée ────────────────────── */
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

  /* ── Helper : compte les acteurs liés à cet admin ───────────── */
  private async countActors(adminId: string) {
    const [partenaires, entreprises, livreurs] = await Promise.all([
      this.partnerRepo
        .createQueryBuilder('p')
        .innerJoin('p.admin', 'a', 'a.id = :id', { id: adminId })
        .getCount(),
      this.companyRepo
        .createQueryBuilder('c')
        .innerJoin('c.admin', 'a', 'a.id = :id', { id: adminId })
        .getCount(),
      this.deliveryRepo
        .createQueryBuilder('d')
        .innerJoin('d.admin', 'a', 'a.id = :id', { id: adminId })
        .getCount(),
    ]);
    return { partenaires, entreprises, livreurs };
  }

  /* ================================================================
   * GET /zones/me
   * Retourne l'identité complète de la zone de l'admin connecté.
   * ================================================================ */
  async getMyZone(userId: string) {
    const admin = await this.requireAdmin(userId);
    const zone  = await this.resolveZone(admin);

    let communes: { id: string; nom: string; code: string }[] = [];
    if (zone?.couvertureIds?.length) {
      const rows = await this.communeRepo.find({
        where: { id: In(zone.couvertureIds) },
        select: { id: true, nom: true, code: true } as any,
      });
      communes = rows.map(c => ({ id: c.id, nom: c.nom, code: c.code }));
    }

    return {
      zoneId:        zone?.id ?? null,
      nom:           zone?.nom           ?? admin.zone ?? 'Zone non assignée',
      code:          zone?.code          ?? 'N/A',
      statut:        zone?.statut        ?? 'actif',
      couvertureType: zone?.couvertureType ?? 'commune',
      rayonKm:       zone?.rayonKm       ? Number(zone.rayonKm) : 0,
      adminNom:      admin.fullName,
      adminId:       admin.id,
      synchroAt:     new Date().toISOString(),
      communeCount:  communes.length,
      communes,
      latitude:      zone?.latitude  ? Number(zone.latitude)  : null,
      longitude:     zone?.longitude ? Number(zone.longitude) : null,
    };
  }

  /* ================================================================
   * GET /zones/statistiques
   * KPIs agrégés de la zone.
   * ================================================================ */
  async getStatistiques(userId: string) {
    const admin  = await this.requireAdmin(userId);
    const counts = await this.countActors(admin.id);

    const { partenaires, entreprises, livreurs } = counts;
    const acteurTotal = partenaires + entreprises + livreurs;

    /* Score de santé : formule pondérée sur la diversité des acteurs */
    const sante = acteurTotal === 0 ? 0 : Math.min(100,
      60
      + Math.round((Math.min(partenaires,  20) / 20)  * 15)
      + Math.round((Math.min(entreprises, 100) / 100) * 15)
      + Math.round((Math.min(livreurs,    200) / 200) * 10),
    );

    return {
      partenaires,
      entreprises,
      livreurs,
      correspondants:      0,
      clients:             0,
      commandes:           0,
      commandesJour:       0,
      commandesTerminees:  0,
      commandesAnnulees:   0,
      livraisonsEnCours:   0,
      litigesOuverts:      0,
      signalementsActifs:  0,
      acteurTotal,
      sante,
    };
  }

  /* ================================================================
   * GET /zones/acteurs
   * Détail des comptes par type d'acteur.
   * ================================================================ */
  async getActeurs(userId: string) {
    const admin  = await this.requireAdmin(userId);
    const counts = await this.countActors(admin.id);
    return {
      ...counts,
      correspondants:     0,
      clients:            0,
      commandes:          0,
      litigesOuverts:     0,
      signalementsActifs: 0,
    };
  }

  /* ================================================================
   * GET /zones/couverture
   * Taux de couverture estimé par commune.
   * ================================================================ */
  async getCouverture(userId: string) {
    const admin  = await this.requireAdmin(userId);
    const zone   = await this.resolveZone(admin);

    if (!zone?.couvertureIds?.length) return [];

    const communes = await this.communeRepo.find({
      where: { id: In(zone.couvertureIds) },
    });

    const { partenaires, entreprises, livreurs } = await this.countActors(admin.id);
    const acteurTotal = partenaires + entreprises + livreurs;
    const n = communes.length || 1;

    return communes.map((c, i) => {
      /* Distribution proportionnelle — à remplacer par des vraies stats par commune */
      const weight  = i % 3 === 0 ? 1.2 : i % 3 === 1 ? 1.0 : 0.8;
      const acteurs = Math.max(0, Math.round((acteurTotal / n) * weight));
      const pct     = acteurTotal > 0
        ? Math.min(100, Math.round((acteurs / Math.max(acteurTotal, 1)) * n * 100))
        : 0;

      return {
        id:              c.id,
        nom:             c.nom,
        code:            c.code,
        pct:             Math.min(100, Math.max(0, pct)),
        acteurs,
        livreurs:        Math.round(acteurs * 0.5),
        entreprises:     Math.round(acteurs * 0.3),
        clients:         0,
        commandes:       0,
        croissance:      0,
        sante:           pct >= 75 ? 'good' : pct >= 45 ? 'medium' : 'low',
        latitude:        c.latitude  ? Number(c.latitude)  : null,
        longitude:       c.longitude ? Number(c.longitude) : null,
      };
    });
  }

  /* ================================================================
   * GET /zones/preferences
   * Lit les préférences d'alertes sauvegardées.
   * ================================================================ */
  async getPreferences(userId: string): Promise<Record<string, boolean>> {
    const admin = await this.requireAdmin(userId);
    return { ...DEFAULT_ALERT_PREFS, ...(admin.alertPreferences ?? {}) };
  }

  /* ================================================================
   * PATCH /zones/preferences
   * Met à jour les préférences d'alertes de l'admin.
   * ================================================================ */
  async updatePreferences(
    userId: string,
    dto: UpdateAlertPreferencesDto,
  ): Promise<Record<string, boolean>> {
    const admin    = await this.requireAdmin(userId);
    const current  = { ...DEFAULT_ALERT_PREFS, ...(admin.alertPreferences ?? {}) };
    const updated  = { ...current, ...dto };
    admin.alertPreferences = updated;
    await this.adminRepo.save(admin);
    this.logger.log(`[ZONE] Préférences alertes mises à jour — userId=${userId}`);
    return updated;
  }
}
