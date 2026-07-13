/* ============================================================
 * FICHIER  : src/modules/support/services/support-permission.service.ts
 * MODULE   : Support
 * ROLE     : Résolution de la portée de visibilité des tickets.
 *
 * RESPONSABILITES :
 *   - Centralise les règles de visibilité hiérarchique des tickets.
 *   - SUPER_ADMIN  → visibilité globale (null = aucun filtre SQL).
 *   - ADMIN        → uniquement les acteurs qu'il supervise directement
 *                    (Partner.adminId, Company.adminId, Delivery.adminId).
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
 *     Repository<Correspondent>  (InjectRepository)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-04
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
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

  /** Collecte les userId de tous les acteurs directement créés par cet admin. */
  private async resolveAdminScope(adminId: string): Promise<Set<string>> {
    const [partners, companies, deliveries] = await Promise.all([
      this.partnerRepo.find({  where: { adminId },  select: { userId: true } }),
      this.companyRepo.find({  where: { adminId },  select: { userId: true } }),
      this.deliveryRepo.find({ where: { adminId },  select: { userId: true } }),
    ]);

    return new Set([
      ...partners.map(p => p.userId),
      ...companies.map(c => c.userId),
      ...deliveries.map(d => d.userId),
    ]);
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
