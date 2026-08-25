/* ============================================================
 * SERVICE : admin-stats.service.ts
 *
 * Page "Statistiques" — complète Overview et Finances sans les
 * dupliquer :
 *   • Overview couvre déjà : santé de zone, KPIs 7j, croissance
 *     acteurs jour/semaine/trimestre, top 6 communes, rôles, activité.
 *   • Finances couvre déjà : volume GNF, commissions, flux paiement.
 *   • Ici : liste COMPLÈTE des communes (pas juste le top 6),
 *     tendance des litiges dans le temps (Overview n'a qu'un
 *     compteur ponctuel), activité par rôle dans le temps (pas
 *     juste des compteurs statiques), débit de traitement des
 *     validations (approuvés/refusés, via le journal d'audit —
 *     seule source fiable : User.status seul ne distingue pas un
 *     refus initial d'une suspension ultérieure).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Partner }       from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';
import { AuditLog } from '../../../../database/entities/audit-log.entity';
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { RedisCacheService } from '../../../performance-engine/services/redis-cache.service';

/** Libellés courts S1..S8 / S1..S12 pour les graphes hebdomadaires. */
function weekLabels(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `S${i + 1}`);
}

/** TTL du cache Stats — mêmes agrégats "peu changeants" que l'Overview. */
const STATS_CACHE_TTL_SEC = 60;

@Injectable()
export class AdminStatsService {

  constructor(
    private readonly zoneService: AdminZoneService,
    private readonly cache:       RedisCacheService,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondentRepo: Repository<Correspondent>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getStats(userId: string) {
    const admin = await this.zoneService.adminOf(userId);

    const cacheKey = `admin-stats:${admin.id}`;
    const cached = await this.cache.get<Record<string, unknown>>(cacheKey);
    if (cached) return cached;

    const cids = await this.zoneService.companyIds(admin.id);

    const [communes, litiges, roles, validations] = await Promise.all([
      this.communesFull(admin.id),
      this.litigesTrend(cids, 8),
      this.roleActivityTrend(admin.id, 12),
      this.validationSummary(userId, admin.id),
    ]);

    const result = { communes, litiges, roles, validations };
    await this.cache.set(cacheKey, result, STATS_CACHE_TTL_SEC);
    return result;
  }

  // ── Liste complète des communes (pas de LIMIT, contrairement à Overview) ──
  private async communesFull(adminId: string) {
    const rows = await this.partnerRepo.createQueryBuilder('p')
      .select('p.commune', 'nom')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.adminId = :aid AND p.commune IS NOT NULL', { aid: adminId })
      .groupBy('p.commune')
      .orderBy('cnt', 'DESC')
      .getRawMany();

    const total = rows.reduce((s, r) => s + parseInt(r.cnt), 0) || 1;
    return rows.map(r => ({
      nom:     r.nom as string,
      acteurs: parseInt(r.cnt),
      pct:     Math.round((parseInt(r.cnt) / total) * 100),
    }));
  }

  // ── Litiges ouverts par semaine, sur les `weeks` dernières semaines ──
  private async litigesTrend(cids: string[], weeks: number) {
    if (!cids.length) {
      return weekLabels(weeks).map(x => ({ x, n: 0 }));
    }

    const now  = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 86_400_000);

    const rows = await this.commandeRepo.createQueryBuilder('c')
      .select("DATE_TRUNC('week', c.createdAt)", 'period')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.companyId IN (:...cids) AND c.status = :s AND c.createdAt >= :from', {
        cids, s: CommandeStatus.DISPUTED, from,
      })
      .groupBy("DATE_TRUNC('week', c.createdAt)")
      .getRawMany()
      .catch(() => []);

    const map = new Map<string, number>(
      rows.map(r => [new Date(r.period).toISOString().slice(0, 10), +r.cnt] as [string, number]),
    );

    const result: { x: string; n: number }[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const d = new Date(now.getTime() - w * 7 * 86_400_000);
      // Aligne sur le début de semaine (lundi) pour matcher DATE_TRUNC('week', ...)
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const key = d.toISOString().slice(0, 10);
      result.push({ x: `S${weeks - w}`, n: map.get(key) ?? 0 });
    }
    return result;
  }

  // ── Nouveaux acteurs par rôle, par semaine, sur les `weeks` dernières semaines ──
  private async roleActivityTrend(adminId: string, weeks: number) {
    const now  = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 86_400_000);

    const weekQuery = (repo: Repository<any>, alias: string) =>
      repo.createQueryBuilder(alias)
        .select(`DATE_TRUNC('week', ${alias}.createdAt)`, 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where(`${alias}.adminId = :aid AND ${alias}.createdAt >= :from`, { aid: adminId, from })
        .groupBy(`DATE_TRUNC('week', ${alias}.createdAt)`)
        .getRawMany()
        .catch(() => []);

    const [parRows, comRows, delRows] = await Promise.all([
      weekQuery(this.partnerRepo, 'p'),
      weekQuery(this.companyRepo, 'c'),
      weekQuery(this.deliveryRepo, 'd'),
    ]);

    // Correspondants : rattachés via livreurId, colonne pas toujours présente
    // selon la migration (même garde défensive que admin-overview.service.ts).
    let corRows: { period: Date | string; cnt: string }[] = [];
    try {
      const dids = await this.zoneService.deliveryIds(adminId);
      if (dids.length) {
        corRows = await this.correspondentRepo.createQueryBuilder('cor')
          .select("DATE_TRUNC('week', cor.createdAt)", 'period')
          .addSelect('COUNT(*)', 'cnt')
          .where('cor.livreurId IN (:...dids) AND cor.createdAt >= :from', { dids, from })
          .groupBy("DATE_TRUNC('week', cor.createdAt)")
          .getRawMany();
      }
    } catch { /* colonne absente selon la migration — ignoré silencieusement */ }

    const toMap = (rows: { period: Date | string; cnt: string }[]) =>
      new Map<string, number>(
        rows.map(r => [new Date(r.period).toISOString().slice(0, 10), +r.cnt] as [string, number]),
      );

    const parMap = toMap(parRows);
    const comMap = toMap(comRows);
    const delMap = toMap(delRows);
    const corMap = toMap(corRows);

    const result: { x: string; par: number; ent: number; lvr: number; cor: number }[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      const d = new Date(now.getTime() - w * 7 * 86_400_000);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      const key = d.toISOString().slice(0, 10);
      result.push({
        x:   `S${weeks - w}`,
        par: parMap.get(key) ?? 0,
        ent: comMap.get(key) ?? 0,
        lvr: delMap.get(key) ?? 0,
        cor: corMap.get(key) ?? 0,
      });
    }
    return result;
  }

  // ── Débit de traitement des validations : en attente / approuvés / refusés ──
  // Approuvés/refusés : journal d'audit (source fiable — User.status seul ne
  // distingue pas un refus initial d'une suspension ultérieure, les deux
  // valant SUSPENDED). En attente : même requête que admin-overview.service.ts.
  private async validationSummary(actorId: string, adminId: string) {
    const [pendPar, pendEnt, pendLvr, appRow, rejRow] = await Promise.all([
      this.userRepo.createQueryBuilder('u')
        .innerJoin('u.partner', 'p')
        .where('p.adminId = :aid AND u.status = :s', { aid: adminId, s: UserStatus.PENDING })
        .getCount(),
      this.userRepo.createQueryBuilder('u')
        .innerJoin('u.company', 'c')
        .where('c.adminId = :aid AND u.status = :s', { aid: adminId, s: UserStatus.PENDING })
        .getCount(),
      this.userRepo.createQueryBuilder('u')
        .innerJoin('u.delivery', 'd')
        .where('d.adminId = :aid AND u.status = :s', { aid: adminId, s: UserStatus.PENDING })
        .getCount(),
      this.auditLogRepo.createQueryBuilder('a')
        .where('a.actorId = :actorId AND a.action ILIKE :p', { actorId, p: '%validé le compte%' })
        .getCount(),
      this.auditLogRepo.createQueryBuilder('a')
        .where('a.actorId = :actorId AND a.action ILIKE :p', { actorId, p: '%refusé le compte%' })
        .getCount(),
    ]);

    return { enAttente: pendPar + pendEnt + pendLvr, approuves: appRow, refuses: rejRow };
  }
}
