/* ============================================================
 * SERVICE : admin-overview.service.ts
 *
 * Vue d'ensemble du dashboard : profil léger (sidebar), KPIs,
 * file d'attente, graphes de croissance, communes, rôles, activité.
 *
 * Ce service est le plus lourd du module car il agrège des données
 * issues de 9 entités.  Toutes les requêtes indépendantes sont
 * parallélisées via Promise.all pour minimiser la latence.
 *
 * Dépend de AdminZoneService pour la résolution du profil et des IDs.
 * ============================================================ */

import { Injectable }       from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';

import { AdminZoneService } from './admin-zone.service';

import { Partner }       from '../../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../../database/entities/profiles/correspondant-profile.entity';
import { CreationCode, CodeStatus } from '../../../../database/entities/code-creation.entity';
import { Report, ReportStatus }     from '../../../../database/entities/report.entity';
import { AuditLog }      from '../../../../database/entities/audit-log.entity';
import { User, UserStatus } from '../../../../database/entities/user.entity';
import { Commande, CommandeStatus } from '../../../../database/entities/commande/commande.entity';

import { relTime, iconFa, iconKind } from '../helpers/admin.helpers';

/** Libellés courts des jours de la semaine (index 0 = Dimanche). */
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

@Injectable()
export class AdminOverviewService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondentRepo: Repository<Correspondent>,

    @InjectRepository(CreationCode)
    private readonly codeRepo: Repository<CreationCode>,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,
  ) {}

  // ════════════════════════════════════════════════════════════
  // PROFIL LÉGER (sidebar)
  // ════════════════════════════════════════════════════════════

  /**
   * Endpoint léger pour la sidebar : nom de l'admin, nom de zone
   * et nombre de communes distinctes présentes parmi les partenaires.
   *
   * 1 adminOf() + 1 COUNT DISTINCT — très rapide.
   */
  async getAdminProfile(userId: string) {
    const admin = await this.zoneService.adminOf(userId);

    const row = await this.partnerRepo.createQueryBuilder('p')
      .select('COUNT(DISTINCT p.commune)', 'cnt')
      .where('p.adminId = :aid AND p.commune IS NOT NULL', { aid: admin.id })
      .getRawOne()
      .catch(() => ({ cnt: 0 }));

    return {
      adminName:     admin.fullName ?? 'Admin',
      zoneName:      admin.zone     ?? 'Zone',
      communesCount: +row?.cnt || 0,
    };
  }

  // ════════════════════════════════════════════════════════════
  // VUE D'ENSEMBLE COMPLÈTE
  // ════════════════════════════════════════════════════════════

  /**
   * Agrège toutes les données de la page Vue d'ensemble :
   *
   *  • zone          — nom, score de santé (100 − litiges×500/total), adminName
   *  • kpis          — acteurs totaux, commandes semaine, volume M GNF, litiges
   *  • queue         — validations / signalements / codes / commandes en cours
   *  • chart         — croissance sur 7j / 4 semaines / 4 trimestres
   *  • communes      — top 6 communes par nombre de partenaires
   *  • rolesRepartition — par/ent/lvr/cor
   *  • activite      — 5 dernières entrées AuditLog
   */
  async getOverview(userId: string) {
    const admin = await this.zoneService.adminOf(userId);

    // IDs des acteurs de la zone — récupérés en parallèle
    const [pids, cids, dids] = await Promise.all([
      this.zoneService.partnerIds(admin.id),
      this.zoneService.companyIds(admin.id),
      this.zoneService.deliveryIds(admin.id),
    ]);

    // Correspondants : le champ livreurId peut ne pas exister selon la migration
    let corCount = 0;
    try {
      if (dids.length) {
        corCount = await this.correspondentRepo.count({
          where: { livreurId: In(dids) } as any,
        });
      }
    } catch { /* champ absent — on ignore silencieusement */ }

    const total = pids.length + cids.length + dids.length + corCount;
    const now   = new Date();
    const w7    = new Date(now.getTime() - 7  * 86_400_000); // 7 derniers jours
    const m30   = new Date(now.getTime() - 30 * 86_400_000); // 30 derniers jours

    // ── File d'attente + données KPI ──────────────────────────
    // Toutes ces requêtes sont indépendantes → parallélisation complète
    const [pendPar, pendEnt, pendLvr, signalCnt, pendCode, cmdEnCours] = await Promise.all([
      // Comptes partenaires en attente de validation
      pids.length
        ? this.userRepo.createQueryBuilder('u')
            .innerJoin('u.partner', 'p')
            .where('p.adminId = :aid AND u.status = :s', { aid: admin.id, s: UserStatus.PENDING })
            .getCount()
        : 0,
      // Comptes entreprises en attente
      cids.length
        ? this.userRepo.createQueryBuilder('u')
            .innerJoin('u.company', 'c')
            .where('c.adminId = :aid AND u.status = :s', { aid: admin.id, s: UserStatus.PENDING })
            .getCount()
        : 0,
      // Comptes livreurs en attente
      dids.length
        ? this.userRepo.createQueryBuilder('u')
            .innerJoin('u.delivery', 'd')
            .where('d.adminId = :aid AND u.status = :s', { aid: admin.id, s: UserStatus.PENDING })
            .getCount()
        : 0,
      // Signalements globaux en attente (pas encore filtrés par zone)
      this.reportRepo.count({ where: { status: ReportStatus.PENDING } }),
      // Codes de création en attente générés par cet admin
      this.codeRepo.count({ where: { adminId: admin.id, status: CodeStatus.PENDING } }),
      // Commandes actives dans les entreprises de la zone
      cids.length
        ? this.commandeRepo.createQueryBuilder('c')
            .where('c.companyId IN (:...cids)', { cids })
            .andWhere('c.status NOT IN (:...done)', {
              done: [
                CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED,
                CommandeStatus.CANCELLED, CommandeStatus.REFUNDED,
              ],
            })
            .getCount()
            .catch(() => 0)
        : 0,
    ]);

    // ── Score de santé de la zone ─────────────────────────────
    // Formule : 100 − (litiges / total_commandes) × 500, capé [0, 100]
    // Un taux de litiges de 20% donne un score de 0 (zone critique).
    let sante = 95;
    if (cids.length) {
      try {
        const [dis, tot] = await Promise.all([
          this.commandeRepo.count({ where: { companyId: In(cids), status: CommandeStatus.DISPUTED } }),
          this.commandeRepo.count({ where: { companyId: In(cids) } }),
        ]);
        if (tot > 0) {
          sante = Math.max(0, Math.min(100, Math.round(100 - (dis / tot) * 500)));
        }
      } catch { /* ignore */ }
    }

    // ── Top 6 communes par nombre de partenaires ──────────────
    const comRows = await this.partnerRepo.createQueryBuilder('p')
      .select('p.commune', 'nom')
      .addSelect('COUNT(*)', 'cnt')
      .where('p.adminId = :aid AND p.commune IS NOT NULL', { aid: admin.id })
      .groupBy('p.commune')
      .orderBy('cnt', 'DESC')
      .limit(6)
      .getRawMany();

    const comTotal = comRows.reduce((s, r) => s + parseInt(r.cnt), 0) || 1;
    const communes = comRows.map(r => ({
      nom:     r.nom as string,
      acteurs: parseInt(r.cnt),
      pct:     Math.round((parseInt(r.cnt) / comTotal) * 100),
    }));

    // ── KPIs numériques ───────────────────────────────────────
    let cmdSem = 0, volMGnf = 0, litiges = 0;
    if (cids.length) {
      const [cc, lc, vr] = await Promise.all([
        // Commandes créées dans les 7 derniers jours
        this.commandeRepo.count({ where: { companyId: In(cids), createdAt: Between(w7, now) } })
          .catch(() => 0),
        // Litiges ouverts (toutes dates)
        this.commandeRepo.count({ where: { companyId: In(cids), status: CommandeStatus.DISPUTED } })
          .catch(() => 0),
        // Volume GNF des commandes livrées sur 7 jours
        this.commandeRepo.createQueryBuilder('c')
          .select('COALESCE(SUM(CAST(c.total AS DECIMAL)), 0)', 'v')
          .where('c.companyId IN (:...cids)', { cids })
          .andWhere('c.status IN (:...ok)', {
            ok: [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED],
          })
          .andWhere('c.createdAt >= :from', { from: w7 })
          .getRawOne()
          .catch(() => ({ v: 0 })),
      ]);
      cmdSem  = cc;
      litiges = lc;
      volMGnf = Math.round((+vr?.v || 0) / 1_000_000);
    }

    // Delta KPI acteurs : nouveaux acteurs dans les 30 derniers jours
    const newM = await Promise.all([
      this.partnerRepo.count({ where: { adminId: admin.id, createdAt: Between(m30, now) } }).catch(() => 0),
      this.companyRepo.count({ where: { adminId: admin.id, createdAt: Between(m30, now) } }).catch(() => 0),
      this.deliveryRepo.count({ where: { adminId: admin.id, createdAt: Between(m30, now) } }).catch(() => 0),
    ]).then(([p, c, d]) => p + c + d);

    // ── Activité récente (5 dernières entrées AuditLog DE CET ADMIN) ───────
    const logs = await this.auditLogRepo.find({
      where:  { actorId: userId },
      order:  { createdAt: 'DESC' },
      take:   5,
    });
    const activite = logs.map(a => ({
      icone: iconFa(a.icon),
      kind:  iconKind(a.icon, a.action),
      texte: `<b>${a.actorName}</b> ${a.action}`,
      when:  relTime(a.createdAt),
    }));

    // ── Graphes de croissance ─────────────────────────────────
    const [semaine, mois, annee] = await Promise.all([
      this.daySlice(admin.id, cids, 7),
      this.weekSlice(admin.id, cids, 4),
      this.quarterSlice(admin.id, cids),
    ]);

    return {
      zone: { nom: admin.zone ?? 'Zone', sante, adminName: admin.fullName },
      kpis: [
        { cle: 'acteurs',   valeur: total.toLocaleString('fr-FR'),  label: 'Acteurs actifs dans la zone',    delta: `+${newM}`, trend: 'up'   },
        { cle: 'commandes', valeur: cmdSem.toLocaleString('fr-FR'), label: 'Commandes cette semaine',        delta: '+0',       trend: 'up'   },
        { cle: 'volume',    valeur: volMGnf.toString(), unite: 'M GNF', label: "Volume d'affaires (semaine)", delta: '+0%',     trend: 'up'   },
        { cle: 'litiges',   valeur: litiges.toString(), unite: '',   label: 'Litiges ouverts',                delta: '0',        trend: 'down' },
      ],
      queue: [
        { v: pendPar + pendEnt + pendLvr, label: 'Comptes à valider',      icone: 'fa-user-check',     kind: 'warn',  nav: 'validations'  },
        { v: signalCnt,                   label: 'Signalements à traiter', icone: 'fa-flag',           kind: 'alert', nav: 'signalements' },
        { v: pendCode,                    label: 'Codes en attente',       icone: 'fa-qrcode',         kind: 'info',  nav: 'codes'        },
        { v: cmdEnCours,                  label: 'Commandes en cours',     icone: 'fa-scale-balanced', kind: 'ok',    nav: 'commandes'    },
      ],
      chart: { semaine, mois, annee },
      communes,
      rolesRepartition: [
        { type: 'par', n: pids.length },
        { type: 'ent', n: cids.length },
        { type: 'lvr', n: dids.length },
        { type: 'cor', n: corCount    },
      ],
      activite,
    };
  }

  // ════════════════════════════════════════════════════════════
  // TRANCHES TEMPORELLES POUR LES GRAPHES
  // ════════════════════════════════════════════════════════════
  //
  // Principe d'optimisation :
  //   Avant : N × 4 requêtes COUNT séparées (7×4 = 28 pour la semaine)
  //   Après : 4 requêtes GROUP BY DATE_TRUNC pour toute la période
  //
  // Les résultats sont indexés dans des Maps JS (O(1) par lookup),
  // puis assemblés en tableau pour le frontend.
  // ─────────────────────────────────────────────────────────────

  /**
   * Construit une Map<'YYYY-MM-DD', number> à partir des lignes brutes
   * retournées par un GROUP BY DATE_TRUNC('day', ...).
   */
  private buildDayMap(rows: { period: Date | string; cnt: string }[]): Map<string, number> {
    return new Map(rows.map(r => [
      new Date(r.period).toISOString().slice(0, 10),
      +r.cnt,
    ]));
  }

  /**
   * Graphe sur les N derniers jours (vue "Semaine").
   * Retourne [{x:'Lun', a:acteurs_créés, c:commandes÷10}, ...]
   *
   * 4 requêtes GROUP BY DAY au lieu de daysBack × 4 COUNT.
   * La division par 10 des commandes harmonise les deux séries visuellement.
   */
  private async daySlice(adminId: string, cids: string[], daysBack: number) {
    const now  = new Date();
    const from = new Date(now.getTime() - daysBack * 86_400_000);

    const [parRows, comRows, delRows, cmdRows] = await Promise.all([
      this.partnerRepo.createQueryBuilder('p')
        .select("DATE_TRUNC('day', p.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('p.adminId = :aid AND p.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', p.createdAt)")
        .getRawMany().catch(() => []),

      this.companyRepo.createQueryBuilder('c')
        .select("DATE_TRUNC('day', c.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('c.adminId = :aid AND c.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', c.createdAt)")
        .getRawMany().catch(() => []),

      this.deliveryRepo.createQueryBuilder('d')
        .select("DATE_TRUNC('day', d.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('d.adminId = :aid AND d.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', d.createdAt)")
        .getRawMany().catch(() => []),

      cids.length
        ? this.commandeRepo.createQueryBuilder('cmd')
            .select("DATE_TRUNC('day', cmd.createdAt)", 'period')
            .addSelect('COUNT(*)', 'cnt')
            .where('cmd.companyId IN (:...cids) AND cmd.createdAt >= :from', { cids, from })
            .groupBy("DATE_TRUNC('day', cmd.createdAt)")
            .getRawMany().catch(() => [])
        : Promise.resolve([]),
    ]);

    const parMap = this.buildDayMap(parRows);
    const comMap = this.buildDayMap(comRows);
    const delMap = this.buildDayMap(delRows);
    const cmdMap = this.buildDayMap(cmdRows);

    const result: { x: string; a: number; c: number }[] = [];
    for (let i = daysBack - 1; i >= 0; i--) {
      const d   = new Date(now); d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result.push({
        x: DAY_LABELS[d.getDay()],
        a: (parMap.get(key) ?? 0) + (comMap.get(key) ?? 0) + (delMap.get(key) ?? 0),
        c: Math.floor((cmdMap.get(key) ?? 0) / 10),
      });
    }
    return result;
  }

  /**
   * Graphe sur les N dernières semaines (vue "Mois").
   * Retourne [{x:'S1', a, c}, ...]
   *
   * Utilise DATE_TRUNC('day') pour une granularité fine, puis agrège
   * les jours par semaine en JS — 4 requêtes DB quelle que soit la durée.
   */
  private async weekSlice(adminId: string, cids: string[], weeks: number) {
    const now  = new Date();
    const from = new Date(now.getTime() - weeks * 7 * 86_400_000);

    const [parRows, comRows, delRows, cmdRows] = await Promise.all([
      this.partnerRepo.createQueryBuilder('p')
        .select("DATE_TRUNC('day', p.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('p.adminId = :aid AND p.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', p.createdAt)")
        .getRawMany().catch(() => []),

      this.companyRepo.createQueryBuilder('c')
        .select("DATE_TRUNC('day', c.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('c.adminId = :aid AND c.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', c.createdAt)")
        .getRawMany().catch(() => []),

      this.deliveryRepo.createQueryBuilder('d')
        .select("DATE_TRUNC('day', d.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('d.adminId = :aid AND d.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('day', d.createdAt)")
        .getRawMany().catch(() => []),

      cids.length
        ? this.commandeRepo.createQueryBuilder('cmd')
            .select("DATE_TRUNC('day', cmd.createdAt)", 'period')
            .addSelect('COUNT(*)', 'cnt')
            .where('cmd.companyId IN (:...cids) AND cmd.createdAt >= :from', { cids, from })
            .groupBy("DATE_TRUNC('day', cmd.createdAt)")
            .getRawMany().catch(() => [])
        : Promise.resolve([]),
    ]);

    const parMap = this.buildDayMap(parRows);
    const comMap = this.buildDayMap(comRows);
    const delMap = this.buildDayMap(delRows);
    const cmdMap = this.buildDayMap(cmdRows);

    // Agrégation JS : somme des jours par semaine glissante
    const result: { x: string; a: number; c: number }[] = [];
    for (let w = weeks - 1; w >= 0; w--) {
      let a = 0, c = 0;
      for (let day = 0; day < 7; day++) {
        const d   = new Date(now); d.setDate(now.getDate() - w * 7 - day);
        const key = d.toISOString().slice(0, 10);
        a += (parMap.get(key) ?? 0) + (comMap.get(key) ?? 0) + (delMap.get(key) ?? 0);
        c += cmdMap.get(key) ?? 0;
      }
      result.unshift({ x: `S${weeks - w}`, a, c: Math.floor(c / 10) });
    }
    return result;
  }

  /**
   * Graphe sur les 4 derniers trimestres (vue "Année").
   * Retourne [{x:'T1', a, c}, ...]
   *
   * Utilise DATE_TRUNC('month') puis agrège les mois par trimestre en JS.
   * Les commandes sont divisées par 100 pour s'aligner à l'échelle des acteurs.
   * 4 requêtes DB au lieu de 4 × 4 = 16.
   */
  private async quarterSlice(adminId: string, cids: string[]) {
    const now  = new Date();
    const from = new Date(now.getFullYear() - 1, now.getMonth(), 1); // 12 mois d'historique

    const [parRows, comRows, delRows, cmdRows] = await Promise.all([
      this.partnerRepo.createQueryBuilder('p')
        .select("DATE_TRUNC('month', p.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('p.adminId = :aid AND p.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('month', p.createdAt)")
        .getRawMany().catch(() => []),

      this.companyRepo.createQueryBuilder('c')
        .select("DATE_TRUNC('month', c.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('c.adminId = :aid AND c.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('month', c.createdAt)")
        .getRawMany().catch(() => []),

      this.deliveryRepo.createQueryBuilder('d')
        .select("DATE_TRUNC('month', d.createdAt)", 'period')
        .addSelect('COUNT(*)', 'cnt')
        .where('d.adminId = :aid AND d.createdAt >= :from', { aid: adminId, from })
        .groupBy("DATE_TRUNC('month', d.createdAt)")
        .getRawMany().catch(() => []),

      cids.length
        ? this.commandeRepo.createQueryBuilder('cmd')
            .select("DATE_TRUNC('month', cmd.createdAt)", 'period')
            .addSelect('COUNT(*)', 'cnt')
            .where('cmd.companyId IN (:...cids) AND cmd.createdAt >= :from', { cids, from })
            .groupBy("DATE_TRUNC('month', cmd.createdAt)")
            .getRawMany().catch(() => [])
        : Promise.resolve([]),
    ]);

    // Map mois YYYY-MM → count
    const toMonthMap = (rows: any[]) =>
      new Map(rows.map(r => [new Date(r.period).toISOString().slice(0, 7), +r.cnt]));

    const parMap = toMonthMap(parRows);
    const comMap = toMonthMap(comRows);
    const delMap = toMonthMap(delRows);
    const cmdMap = toMonthMap(cmdRows);

    // Agrégation JS : somme des 3 mois par trimestre
    const curQ  = Math.floor(now.getMonth() / 3);
    const Q     = ['T1', 'T2', 'T3', 'T4'];
    const result: { x: string; a: number; c: number }[] = [];

    for (let i = 3; i >= 0; i--) {
      const qi   = (curQ - i + 4) % 4;
      const year = qi <= curQ ? now.getFullYear() : now.getFullYear() - 1;
      let a = 0, c = 0;
      for (let m = 0; m < 3; m++) {
        const month = String(qi * 3 + m + 1).padStart(2, '0');
        const key   = `${year}-${month}`;
        a += (parMap.get(key) ?? 0) + (comMap.get(key) ?? 0) + (delMap.get(key) ?? 0);
        c += cmdMap.get(key) ?? 0;
      }
      result.push({ x: Q[qi], a, c: Math.floor(c / 100) });
    }
    return result;
  }
}
