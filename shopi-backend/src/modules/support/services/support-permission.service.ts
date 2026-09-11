/* ============================================================
 * FICHIER  : src/modules/support/services/support-permission.service.ts
 * MODULE   : Support
 * ROLE     : Résolution de la portée de visibilité des tickets.
 *
 * RESPONSABILITES :
 *   - Centralise les règles de visibilité hiérarchique des tickets.
 *   - SUPER_ADMIN  → visibilité globale (null = aucun filtre SQL).
 *   - ADMIN        → union de deux ensembles :
 *                    1. les acteurs qu'il supervise directement
 *                       (Partner.adminId, Company.adminId, Delivery.adminId) ;
 *                    2. les acteurs de sa "communauté" support assignée par
 *                       le super-admin (Admin.paysAssigne / villeAssignee /
 *                       zoneId — voir admin-profile.entity.ts), résolue via
 *                       les colonnes structurées Partner/Company/Delivery
 *                       .paysId/.villeId (peuplées par GeoResolutionService,
 *                       jamais par correspondance de texte ici).
 *   - PARTNER      → uniquement les acteurs supervisés dans son réseau
 *                    (Company.partnerId, Delivery.partnerId, Correspondent.partnerId).
 *   - Autres rôles → ensemble vide (aucun accès tier agent).
 *
 * DESIGN :
 *   - Utilise req.user.actorId (UUID du profil, stocké dans le JWT) directement.
 *   - Retourne Set<string> | null pour permettre une décision atomique
 *     dans TicketService.findAllScoped() et findOneAsAgentScoped().
 *   - Les requêtes sont parallèles (Promise.all) pour limiter la latence.
 *
 * SECURITE (OWASP A01:2021 — Broken Access Control) :
 *   - Toutes les décisions de filtrage sont exclusivement côté serveur.
 *   - Un attaquant ne peut pas forger sa portée côté frontend.
 *
 * DEPENDANCES :
 *   - Repository<Partner>, Repository<Company>, Repository<Delivery>,
 *     Repository<Correspondent>, Repository<Admin>, Repository<GeoZone>
 *     (InjectRepository)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Admin }         from '../../../database/entities/profiles/admin-profile.entity';
import { GeoZone }       from '../../../database/entities/geo/geo-zone.entity';
import { UserRole }      from '../../../common/enums/user-role.enum';

@Injectable()
export class SupportPermissionService {

  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondentRepo: Repository<Correspondent>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(GeoZone)
    private readonly zoneRepo: Repository<GeoZone>,
  ) {}

  /**
   * Résout l'ensemble des userId dont les tickets sont visibles par l'agent.
   *
   * @param actorId  UUID du profil (req.user.actorId) — undefined = pas de profil enregistré
   * @param role     Rôle de l'agent (UserRole string)
   * @returns        null  → SUPER_ADMIN (aucun filtre, accès global)
   *                Set<string> → userIds autorisés (peut être vide si aucun acteur supervisé)
   */
  async resolveVisibleUserIds(
    actorId: string | undefined,
    role: string,
  ): Promise<Set<string> | null> {
    if (role === UserRole.SUPER_ADMIN) return null;
    if (!actorId) return new Set();

    if (role === UserRole.ADMIN)   return this.resolveAdminScope(actorId);
    if (role === UserRole.PARTNER) return this.resolvePartnerScope(actorId);

    return new Set();
  }

  /**
   * Collecte les userId de tous les acteurs directement créés par cet
   * admin, UNIONNÉS avec ceux de sa "communauté" support assignée
   * (pays, ville ou zone — voir setAssignedCountry/Ville/Zone dans
   * AdminsService). Un admin peut n'avoir aucune communauté assignée
   * (paysAssigne/villeAssignee/zoneId tous null) : dans ce cas seule
   * la portée "créés par moi" s'applique, comportement identique à
   * avant l'introduction de la communauté.
   */
  private async resolveAdminScope(adminId: string): Promise<Set<string>> {
    const [partners, companies, deliveries, admin] = await Promise.all([
      this.partnerRepo.find({  where: { adminId },  select: { userId: true } }),
      this.companyRepo.find({  where: { adminId },  select: { userId: true } }),
      this.deliveryRepo.find({ where: { adminId },  select: { userId: true } }),
      this.adminRepo.findOne({ where: { id: adminId }, select: ['paysAssigne', 'villeAssignee', 'zoneId'] }),
    ]);

    const ids = new Set<string>([
      ...partners.map(p => p.userId),
      ...companies.map(c => c.userId),
      ...deliveries.map(d => d.userId),
    ]);

    if (admin) {
      const communaute = await this.resolveCommunauteScope(admin);
      for (const id of communaute) ids.add(id);
    }

    return ids;
  }

  /**
   * Résout les userId des acteurs appartenant à la communauté géo
   * assignée à un admin (paysAssigne / villeAssignee / zoneId).
   * Filtre sur les colonnes structurées paysId/villeId de Partner/
   * Company/Delivery — jamais sur leurs champs texte libre ville/pays
   * (voir GeoResolutionService pour comment ces colonnes sont peuplées).
   *
   * Priorité si plusieurs assignations coexistent : ville la plus
   * précise, puis pays, puis zone (une zone peut elle-même couvrir un
   * pays ou une préfecture — tout est unioné de toute façon, l'ordre
   * n'affecte que la lisibilité du code, pas le résultat).
   */
  private async resolveCommunauteScope(
    admin: Pick<Admin, 'paysAssigne' | 'villeAssignee' | 'zoneId'>,
  ): Promise<Set<string>> {
    const ids = new Set<string>();

    if (admin.paysAssigne) {
      const [p, c, d] = await Promise.all([
        this.partnerRepo.find({  where: { paysId: admin.paysAssigne },  select: { userId: true } }),
        this.companyRepo.find({  where: { paysId: admin.paysAssigne },  select: { userId: true } }),
        this.deliveryRepo.find({ where: { paysId: admin.paysAssigne },  select: { userId: true } }),
      ]);
      [...p, ...c, ...d].forEach(a => ids.add(a.userId));
    }

    if (admin.villeAssignee) {
      const [p, c, d] = await Promise.all([
        this.partnerRepo.find({  where: { villeId: admin.villeAssignee },  select: { userId: true } }),
        this.companyRepo.find({  where: { villeId: admin.villeAssignee },  select: { userId: true } }),
        this.deliveryRepo.find({ where: { villeId: admin.villeAssignee },  select: { userId: true } }),
      ]);
      [...p, ...c, ...d].forEach(a => ids.add(a.userId));
    }

    if (admin.zoneId) {
      const zone = await this.zoneRepo.findOne({ where: { id: admin.zoneId } });
      /* Une GeoZone couvre un ensemble d'éléments à UN niveau donné
       * (couvertureType). Les acteurs n'ont de colonnes structurées
       * qu'au niveau pays/ville — une zone définie à un niveau plus
       * fin (région/commune/quartier) ne peut donc pas encore être
       * croisée avec les acteurs (limitation connue, cohérente avec
       * l'absence de regionId/communeId sur Partner/Company/Delivery). */
      if (zone?.couvertureIds?.length) {
        const col = zone.couvertureType === 'pays' ? 'paysId'
                  : zone.couvertureType === 'prefecture' ? 'villeId'
                  : null;
        if (col) {
          const [p, c, d] = await Promise.all([
            this.partnerRepo.find({  where: { [col]: In(zone.couvertureIds) },  select: { userId: true } }),
            this.companyRepo.find({  where: { [col]: In(zone.couvertureIds) },  select: { userId: true } }),
            this.deliveryRepo.find({ where: { [col]: In(zone.couvertureIds) },  select: { userId: true } }),
          ]);
          [...p, ...c, ...d].forEach(a => ids.add(a.userId));
        }
      }
    }

    return ids;
  }

  /** Collecte les userId de tous les acteurs supervisés par ce partenaire. */
  private async resolvePartnerScope(partnerId: string): Promise<Set<string>> {
    const [companies, deliveries, correspondants] = await Promise.all([
      this.companyRepo.find({       where: { partnerId }, select: { userId: true } }),
      this.deliveryRepo.find({      where: { partnerId }, select: { userId: true } }),
      this.correspondentRepo.find({ where: { partnerId }, select: { userId: true } }),
    ]);

    return new Set([
      ...companies.map(c => c.userId),
      ...deliveries.map(d => d.userId),
      ...correspondants.map(c => c.userId),
    ]);
  }
}
