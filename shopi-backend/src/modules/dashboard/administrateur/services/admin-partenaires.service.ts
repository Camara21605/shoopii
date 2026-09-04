/* ============================================================
 * SERVICE : admin-partenaires.service.ts
 *
 * Liste des partenaires de la zone avec leur classement,
 * score de confiance et top-3 mis en avant dans le widget.
 *
 * Les scores (conversion, confiance) sont estimés à partir du
 * nombre de recrues jusqu'à ce que les colonnes dédiées soient
 * alimentées par des agrégations sur les commandes réelles.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository }       from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Partner }          from '../../../../database/entities/profiles/partenaire-profile.entity';
import { UserStatus }       from '../../../../database/entities/user.entity';
import { Admin }            from '../../../../database/entities/profiles/admin-profile.entity';
import { RedisCacheService } from '../../../performance-engine/services/redis-cache.service';
import { initials, userName, mapSt } from '../helpers/admin.helpers';

/** Dégradés de couleur attribués aux 3 premiers du classement. */
const GRADS = [
  'linear-gradient(135deg,#0E7490,#22D3EE)', // 1er — cyan
  'linear-gradient(135deg,#6D28D9,#9F67E8)', // 2ème — violet
  'linear-gradient(135deg,#047857,#34D399)', // 3ème — vert
];

/** TTL du cache "partenaires bruts" — voir ACTEURS_CACHE_TTL_SEC dans
 * admin-acteurs.service.ts (même invalidation active, même raisonnement). */
const PARTENAIRES_CACHE_TTL_SEC = 20;

@Injectable()
export class AdminPartenairesService {

  constructor(
    private readonly zoneService: AdminZoneService,
    private readonly cache:       RedisCacheService,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
  ) {}

  /**
   * Charge + calcule le classement complet (avant filtre tier/recherche/
   * pagination) — mis en cache court car c'est la partie coûteuse (jusqu'à
   * 500 lignes + jointure `user`). Invalidé par AdminActeursService
   * (clé `admin-partenaires-raw:${adminId}`) quand un statut change.
   */
  private async loadPartenairesBruts(admin: Admin) {
    const cacheKey = `admin-partenaires-raw:${admin.id}`;
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) return cached;

    const partners = await this.partnerRepo.find({
      where:     { adminId: admin.id },
      relations: ['user'],
      order:     { totalCompanies: 'DESC' },
      // Le classement (tier/rang/top3) dépend de l'ordre sur TOUTE la
      // zone — on plafonne à 500 par sécurité (une zone n'a
      // réalistement pas plus de partenaires que ça) puis on pagine
      // l'affichage séparément ci-dessous, sans casser le classement.
      take: 500,
    });

    const full = partners.map((p, i) => {
      const nom     = userName(p.user);
      const recrues = ((p as any).totalCompanies      ?? 0)
                    + ((p as any).totalDeliveries     ?? 0)
                    + ((p as any).totalCorrespondants ?? 0);

      return {
        id:         p.id,
        userId:     p.user.id, // pour PATCH /acteurs/:id/suspend (attend un User.id, pas un Partner.id)
        nom,
        avatar:     initials(nom),
        commune:    (p as any).commune ?? '—',
        depuis:     new Date(p.user.createdAt).toLocaleDateString('fr-FR', {
          month: 'short', year: 'numeric',
        }),
        tier:       i === 0 ? 'or' : i < 3 ? 'arg' : 'brz',
        recrues,
        // Taux de conversion estimé : minimum 20%, plafonné à 95%
        conversion: Math.min(95, Math.max(20, recrues * 3 + 40)),
        // Score de confiance : élevé si actif, réduit si suspendu
        confiance:  p.user.status === UserStatus.ACTIVE
                    ? Math.min(98, 70 + recrues) : 40,
        statut:     mapSt(p.user.status),
        grad:       GRADS[Math.min(i, 2)],
      };
    });

    await this.cache.set(cacheKey, full, PARTENAIRES_CACHE_TTL_SEC);
    return full;
  }

  /**
   * Retourne la liste complète des partenaires de la zone,
   * triée par nombre de recrues décroissant, avec :
   *   • tier   — 'or' (1er), 'arg' (2e/3e), 'brz' (autres)
   *   • top3   — les 3 premiers avec gradient pour le widget
   *
   * Le nombre de recrues = totalCompanies + totalDeliveries + totalCorrespondants
   * (colonnes dénormalisées sur Partner, mises à jour par triggers / events).
   */
  async getPartenaires(userId: string, tier?: string, search?: string, page = 1, limit = 20) {
    const admin = await this.zoneService.adminOf(userId);
    const full  = await this.loadPartenairesBruts(admin);

    // Top 3 pour le widget de mise en avant (sans données redondantes,
    // toujours calculé sur le classement complet, avant filtrage).
    const top3 = full.slice(0, 3).map(p => ({
      nom:    p.nom,
      avatar: p.avatar,
      v:      p.recrues,
      sub:    `recrues · ${p.conversion}% conversion`,
      grad:   p.grad,
    }));

    // Compteurs par palier — sur l'ensemble complet (pas le sous-filtré),
    // pour que les chips de filtre affichent des totaux stables.
    const counts = {
      all: full.length,
      or:  full.filter(p => p.tier === 'or').length,
      arg: full.filter(p => p.tier === 'arg').length,
      brz: full.filter(p => p.tier === 'brz').length,
    };

    let filtered = full;
    if (tier && tier !== 'all') filtered = filtered.filter(p => p.tier === tier);
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(p => p.nom.toLowerCase().includes(q));
    }

    const safeLimit = Math.min(limit, 100);
    const start = (page - 1) * safeLimit;
    const list  = filtered.slice(start, start + safeLimit);

    return { list, top3, counts, page, limit: safeLimit, total: filtered.length };
  }
}
