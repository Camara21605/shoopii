/* ================================================================
 * FICHIER : src/modules/zone-admin/zone-admin.service.ts
 *
 * RÔLE : Centre de contrôle territorial de l'administrateur
 * (Paramètres → Zone & Couverture).
 *   - Identité de la zone (GeoZone + communes couvertes)
 *   - Statistiques RÉELLES : acteurs invités par l'admin (directement ou
 *     via ses partenaires) et commandes qui les concernent
 *   - Répartition réelle des acteurs et des commandes par commune
 *   - Préférences d'alertes (uniquement celles qui ont un effet réel)
 *
 * BUG CORRIGÉ — les statistiques renvoyaient 0 en dur pour correspondants,
 * clients, commandes, litiges…, et la couverture par commune était une
 * répartition inventée (poids selon l'index de la commune, livreurs =
 * 50 % des acteurs…). Tout est désormais calculé depuis la base.
 *
 * SÉCURITÉ : un admin n'accède qu'à SA zone (userId scopé).
 * ================================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';

import { Admin }         from '../../database/entities/profiles/admin-profile.entity';
import { GeoZone }       from '../../database/entities/geo/geo-zone.entity';
import { GeoCommune }    from '../../database/entities/geo/geo-commune.entity';
import { Partner }       from '../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../database/entities/commande/commande.entity';

import { UpdateAlertPreferencesDto } from './zone-admin.dto';

/* Seules préférences réellement appliquées côté serveur (voir
 * NotificationEventService.notifyAdminNewSignalement). Les 12 autres
 * interrupteurs de l'ancien écran (« Commande importante », « Baisse des
 * ventes »…) étaient enregistrés mais aucune notification correspondante
 * n'a jamais existé : retirés. */
const DEFAULT_ALERT_PREFS: Record<string, boolean> = {
  signalement: true,
};

/* Normalise un nom pour comparer des saisies libres : sans accent, minuscule. */
const norm = (s: string | null | undefined): string =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const escapeLike = (s: string) => s.replace(/[%_\\]/g, m => `\\${m}`);

interface ZoneScope { pids: string[]; cids: string[]; dids: string[] }

@Injectable()
export class ZoneAdminService {

  private readonly logger = new Logger(ZoneAdminService.name);

  constructor(
    @InjectRepository(Admin)         private readonly adminRepo:    Repository<Admin>,
    @InjectRepository(GeoZone)       private readonly zoneRepo:     Repository<GeoZone>,
    @InjectRepository(GeoCommune)    private readonly communeRepo:  Repository<GeoCommune>,
    @InjectRepository(Partner)       private readonly partnerRepo:  Repository<Partner>,
    @InjectRepository(Company)       private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Delivery)      private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Correspondent) private readonly corRepo:      Repository<Correspondent>,
    @InjectRepository(Commande)      private readonly commandeRepo: Repository<Commande>,
  ) {}

  private async requireAdmin(userId: string): Promise<Admin> {
    const admin = await this.adminRepo.findOne({ where: { userId } });
    if (!admin) throw new NotFoundException('Administrateur introuvable.');
    return admin;
  }

  /* La zone assignée : par identifiant, sinon par son nom (insensible à la
   * casse — les noms du référentiel géo sont désormais enregistrés en
   * majuscules alors que admin.zone est une saisie libre). */
  private async resolveZone(admin: Admin): Promise<GeoZone | null> {
    if (admin.zoneId) {
      const z = await this.zoneRepo.findOne({ where: { id: admin.zoneId } });
      if (z) return z;
    }
    if (admin.zone) {
      return this.zoneRepo.findOne({ where: { nom: ILike(escapeLike(admin.zone.trim())) } });
    }
    return null;
  }

  /** Acteurs invités par cet admin (mêmes règles que les pages Acteurs / Commandes). */
  private async scopeOf(adminId: string): Promise<ZoneScope> {
    const [p, c, d] = await Promise.all([
      this.partnerRepo.find({  where: { adminId }, select: ['id'] }),
      this.companyRepo.find({  where: { adminId }, select: ['id'] }),
      this.deliveryRepo.find({ where: { adminId }, select: ['id'] }),
    ]);
    return { pids: p.map(x => x.id), cids: c.map(x => x.id), dids: d.map(x => x.id) };
  }

  /** Condition SQL « la commande touche un acteur de la zone » (null si zone vide). */
  private orderScope(s: ZoneScope): { sql: string; params: Record<string, string[]> } | null {
    const parts: string[] = [];
    const params: Record<string, string[]> = {};
    if (s.cids.length) { parts.push('c.companyId IN (:...cids)');    params.cids = s.cids; }
    if (s.dids.length) { parts.push('c.livreurId IN (:...dids)');    params.dids = s.dids; }
    if (s.pids.length) { parts.push('c.partenaireId IN (:...pids)'); params.pids = s.pids; }
    return parts.length ? { sql: `(${parts.join(' OR ')})`, params } : null;
  }

  /* ================================================================
   * GET /zones/me — identité de la zone
   * ================================================================ */
  async getMyZone(userId: string) {
    const admin = await this.requireAdmin(userId);
    const zone  = await this.resolveZone(admin);

    let communes: { id: string; nom: string; code: string }[] = [];
    if (zone?.couvertureIds?.length && zone.couvertureType === 'commune') {
      const rows = await this.communeRepo.find({
        where: { id: In(zone.couvertureIds) },
        select: { id: true, nom: true, code: true } as any,
        order: { nom: 'ASC' },
      });
      communes = rows.map(c => ({ id: c.id, nom: c.nom, code: c.code }));
    }

    return {
      zoneId:         zone?.id ?? null,
      nom:            zone?.nom ?? admin.zone ?? 'Zone non assignée',
      code:           zone?.code ?? 'N/A',
      statut:         zone?.statut ?? 'actif',
      couvertureType: zone?.couvertureType ?? 'commune',
      rayonKm:        zone?.rayonKm ? Number(zone.rayonKm) : 0,
      adminNom:       admin.fullName,
      adminId:        admin.id,
      synchroAt:      new Date().toISOString(),
      communeCount:   communes.length,
      communes,
      latitude:       zone?.latitude  ? Number(zone.latitude)  : null,
      longitude:      zone?.longitude ? Number(zone.longitude) : null,
    };
  }

  /* ================================================================
   * GET /zones/statistiques — KPIs réels
   * ================================================================ */
  async getStatistiques(userId: string) {
    const admin = await this.requireAdmin(userId);
    const scope = await this.scopeOf(admin.id);
    const { pids, cids, dids } = scope;
    const acteurTotal = pids.length + cids.length + dids.length;

    /* Correspondants rattachés aux entreprises / livreurs / partenaires de la zone */
    const corParts: string[] = [];
    const corParams: Record<string, string[]> = {};
    if (cids.length) { corParts.push('cor.companyId IN (:...cids)');   corParams.cids = cids; }
    if (dids.length) { corParts.push('cor.deliveryId IN (:...dids)');  corParams.dids = dids; }
    if (pids.length) { corParts.push('cor.partnerId IN (:...pids)');   corParams.pids = pids; }

    const cond = this.orderScope(scope);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

    const [correspondants, byStatus, jour, clientsRow] = await Promise.all([
      corParts.length
        ? this.corRepo.createQueryBuilder('cor').where(`(${corParts.join(' OR ')})`, corParams).getCount()
        : Promise.resolve(0),
      cond
        ? this.commandeRepo.createQueryBuilder('c')
            .select('c.status', 'status').addSelect('COUNT(*)', 'n')
            .where(cond.sql, cond.params).groupBy('c.status')
            .getRawMany<{ status: CommandeStatus; n: string }>()
        : Promise.resolve([] as { status: CommandeStatus; n: string }[]),
      cond
        ? this.commandeRepo.createQueryBuilder('c')
            .where(cond.sql, cond.params).andWhere('c.createdAt >= :d', { d: startOfDay }).getCount()
        : Promise.resolve(0),
      cond
        ? this.commandeRepo.createQueryBuilder('c')
            .select('COUNT(DISTINCT c.clientId)', 'n').where(cond.sql, cond.params)
            .getRawOne<{ n: string }>()
        : Promise.resolve({ n: '0' }),
    ]);

    const n = (...sts: CommandeStatus[]) =>
      byStatus.filter(r => sts.includes(r.status)).reduce((s, r) => s + Number(r.n), 0);
    const commandes = byStatus.reduce((s, r) => s + Number(r.n), 0);
    const litiges   = n(CommandeStatus.DISPUTED);

    /* Santé = part des commandes sans litige (même formule que la vue
     * d'ensemble). Sans commande, il n'y a rien à évaluer : null, pas 100 %. */
    const sante = commandes > 0 ? Math.max(0, Math.round(100 - (litiges * 500) / commandes)) : null;

    return {
      partenaires:        pids.length,
      entreprises:        cids.length,
      livreurs:           dids.length,
      correspondants,
      clients:            Number(clientsRow?.n ?? 0),
      commandes,
      commandesJour:      jour,
      commandesTerminees: n(CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED),
      commandesAnnulees:  n(CommandeStatus.CANCELLED, CommandeStatus.REFUNDED),
      livraisonsEnCours:  n(CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT),
      litigesOuverts:     litiges,
      acteurTotal,
      sante,
    };
  }

  /* ================================================================
   * GET /zones/couverture — répartition réelle par commune
   *
   * Un acteur est rattaché à une commune d'après sa commune déclarée
   * (partenaire/entreprise : `commune` ; livreur : communes actives, à
   * défaut sa `zone`) — comparaison sans accent ni casse. Les commandes le
   * sont d'après leur commune de livraison.
   * `pct` = part des acteurs de la zone situés dans cette commune.
   * `sante` : bon = au moins une entreprise ET un livreur ; moyen = l'un des
   * deux ; faible = aucun.
   * ================================================================ */
  async getCouverture(userId: string) {
    const admin = await this.requireAdmin(userId);
    const zone  = await this.resolveZone(admin);
    if (!zone?.couvertureIds?.length || zone.couvertureType !== 'commune') return [];

    const communes = await this.communeRepo.find({ where: { id: In(zone.couvertureIds) }, order: { nom: 'ASC' } });
    const scope = await this.scopeOf(admin.id);

    const [partners, companies, deliveries] = await Promise.all([
      scope.pids.length ? this.partnerRepo.find({  where: { id: In(scope.pids) }, select: ['id', 'commune'] as any }) : [],
      scope.cids.length ? this.companyRepo.find({  where: { id: In(scope.cids) }, select: ['id', 'commune'] as any }) : [],
      scope.dids.length ? this.deliveryRepo.find({ where: { id: In(scope.dids) }, select: ['id', 'zone', 'communesActives'] as any }) : [],
    ]);

    const cond = this.orderScope(scope);
    const orderRows = cond
      ? await this.commandeRepo.createQueryBuilder('c')
          .select('LOWER(c.communeLivraison)', 'commune').addSelect('COUNT(*)', 'n')
          .where(cond.sql, cond.params).andWhere('c.communeLivraison IS NOT NULL')
          .groupBy('LOWER(c.communeLivraison)')
          .getRawMany<{ commune: string; n: string }>()
      : [];
    const ordersBy = new Map<string, number>();
    for (const r of orderRows) {
      const k = norm(r.commune);
      ordersBy.set(k, (ordersBy.get(k) ?? 0) + Number(r.n));
    }

    const totalActors = scope.pids.length + scope.cids.length + scope.dids.length;

    return communes.map(c => {
      const key = norm(c.nom);
      const par = partners.filter(p  => norm((p as any).commune) === key).length;
      const ent = companies.filter(e => norm((e as any).commune) === key).length;
      const liv = deliveries.filter(d => {
        const actives: string[] = Array.isArray((d as any).communesActives) ? (d as any).communesActives : [];
        return actives.length ? actives.some(a => norm(a) === key) : norm((d as any).zone) === key;
      }).length;
      const acteurs = par + ent + liv;
      const sante: 'good' | 'medium' | 'low' = ent > 0 && liv > 0 ? 'good' : ent > 0 || liv > 0 ? 'medium' : 'low';

      return {
        id:          c.id,
        nom:         c.nom,
        code:        c.code,
        pct:         totalActors > 0 ? Math.round((acteurs / totalActors) * 100) : 0,
        acteurs,
        partenaires: par,
        livreurs:    liv,
        entreprises: ent,
        commandes:   ordersBy.get(key) ?? 0,
        sante,
        latitude:    c.latitude  ? Number(c.latitude)  : null,
        longitude:   c.longitude ? Number(c.longitude) : null,
      };
    });
  }

  /* ================================================================
   * Préférences d'alertes
   * ================================================================ */
  async getPreferences(userId: string): Promise<Record<string, boolean>> {
    const admin = await this.requireAdmin(userId);
    return this.effectivePrefs(admin);
  }

  async updatePreferences(userId: string, dto: UpdateAlertPreferencesDto): Promise<Record<string, boolean>> {
    const admin = await this.requireAdmin(userId);
    const next = { ...this.effectivePrefs(admin), ...dto };
    admin.alertPreferences = next;
    await this.adminRepo.save(admin);
    this.logger.log(`[ZONE] Préférences alertes mises à jour — userId=${userId}`);
    return next;
  }

  /* Seules les clés connues sont exposées (d'anciennes clés peuvent subsister en base). */
  private effectivePrefs(admin: Admin): Record<string, boolean> {
    const stored = admin.alertPreferences ?? {};
    return Object.fromEntries(
      Object.entries(DEFAULT_ALERT_PREFS).map(([k, def]) => [k, typeof stored[k] === 'boolean' ? stored[k] : def]),
    );
  }
}
