/* ============================================================
 * SERVICE : admin-commandes.service.ts
 *
 * Commandes de la zone et données financières mensuelles.
 *
 * Commandes : commandes touchant un acteur invité par l'admin (entreprise,
 *             livreur, partenaire) — liste filtrée, statistiques, détail, export.
 *
 * Finances  : graphe mensuel sur 5 mois (volume M GNF + commissions)
 *             et 8 derniers flux financiers admin (distributions).
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { AdminZoneService } from './admin-zone.service';
import { Commande, CommandeStatus }
  from '../../../../database/entities/commande/commande.entity';
import { CommandeCode } from '../../../../database/entities/commande/commande-code.entity';
import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../../database/entities/paiement/paiement-distribution.entity';

import { relTime } from '../helpers/admin.helpers';

/** Labels des mois en français pour l'axe X du graphe financier. */
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

/** Onglets de la page Commandes. */
export type CommandeOnglet = 'toutes' | 'encours' | 'livrees' | 'litiges' | 'annulees';
/** Fenêtre de dates : nombre de jours, ou 'tout'. */
export type CommandePeriode = '7' | '30' | '90' | 'tout';

export interface CommandeFilters {
  onglet?:  CommandeOnglet;
  search?:  string;
  periode?: CommandePeriode;
}

/** Statuts internes regroupés par onglet. */
const TAB_STATUSES: Record<Exclude<CommandeOnglet, 'toutes'>, CommandeStatus[]> = {
  encours:  [CommandeStatus.PENDING, CommandeStatus.PAID, CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT],
  livrees:  [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED],
  litiges:  [CommandeStatus.DISPUTED],
  annulees: [CommandeStatus.CANCELLED, CommandeStatus.REFUNDED],
};

/** Filtres de la query string, ramenés à des valeurs connues (jamais de valeur libre en SQL). */
export function parseCommandeFilters(onglet?: string, search?: string, periode?: string): CommandeFilters {
  const onglets: CommandeOnglet[]  = ['toutes', 'encours', 'livrees', 'litiges', 'annulees'];
  const periodes: CommandePeriode[] = ['7', '30', '90', 'tout'];
  return {
    onglet:  onglets.includes(onglet as CommandeOnglet)   ? (onglet as CommandeOnglet)   : 'toutes',
    periode: periodes.includes(periode as CommandePeriode) ? (periode as CommandePeriode) : 'tout',
    search:  search?.slice(0, 100),
  };
}

/** Résultat brut d'un scope de zone : ids des acteurs créés par l'admin (ou ses partenaires). */
interface ZoneScope { cids: string[]; dids: string[]; pids: string[] }

@Injectable()
export class AdminCommandesService {

  constructor(
    private readonly zoneService: AdminZoneService,

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,
  ) {}

  // ── Helpers privés ───────────────────────────────────────────

  /** Statut interne → code court affiché (couleur + libellé côté frontend). */
  private toSt(s: CommandeStatus): string {
    switch (s) {
      case CommandeStatus.PENDING:
      case CommandeStatus.PAID:            return 'prep';
      case CommandeStatus.IN_PROGRESS:     return 'ship';
      case CommandeStatus.AWAITING_CLIENT: return 'relay';
      case CommandeStatus.DELIVERED:
      case CommandeStatus.AUTO_DELIVERED:  return 'done';
      case CommandeStatus.DISPUTED:        return 'dispute';
      case CommandeStatus.CANCELLED:       return 'cancel';
      case CommandeStatus.REFUNDED:        return 'refund';
      default:                             return 'prep';
    }
  }

  /** Étape (1–4) de repli quand la commande n'a aucun code de validation. */
  private toProg(s: CommandeStatus): number {
    if (s === CommandeStatus.IN_PROGRESS)                                       return 2;
    if (s === CommandeStatus.AWAITING_CLIENT)                                   return 3;
    if (s === CommandeStatus.DELIVERED || s === CommandeStatus.AUTO_DELIVERED)  return 4;
    return 1;
  }

  /**
   * Périmètre "zone" de l'admin : les commandes sur lesquelles au moins un des
   * acteurs qu'il a invités (entreprise, livreur, partenaire — directement ou
   * via un de ses partenaires) intervient.
   */
  private async scopeOf(userId: string): Promise<ZoneScope> {
    const admin = await this.zoneService.adminOf(userId);
    const [cids, dids, pids] = await Promise.all([
      this.zoneService.companyIds(admin.id),
      this.zoneService.deliveryIds(admin.id),
      this.zoneService.partnerIds(admin.id),
    ]);
    return { cids, dids, pids };
  }

  /** Condition SQL "la commande touche un acteur de la zone" (null si zone vide). */
  private scopeCondition(scope: ZoneScope): { sql: string; params: Record<string, string[]> } | null {
    const parts: string[] = [];
    const params: Record<string, string[]> = {};
    if (scope.cids.length) { parts.push('c.companyId IN (:...cids)');    params.cids = scope.cids; }
    if (scope.dids.length) { parts.push('c.livreurId IN (:...dids)');    params.dids = scope.dids; }
    if (scope.pids.length) { parts.push('c.partenaireId IN (:...pids)'); params.pids = scope.pids; }
    return parts.length ? { sql: `(${parts.join(' OR ')})`, params } : null;
  }

  /** Filtres d'onglet / recherche / période, appliqués à la liste et à son export. */
  private applyFilters(qb: SelectQueryBuilder<Commande>, f: CommandeFilters): void {
    if (f.onglet && f.onglet !== 'toutes' && TAB_STATUSES[f.onglet]) {
      qb.andWhere('c.status IN (:...tabStatuses)', { tabStatuses: TAB_STATUSES[f.onglet] });
    }
    const days = f.periode && f.periode !== 'tout' ? Number(f.periode) : 0;
    if (days > 0) {
      qb.andWhere('c.createdAt >= :since', { since: new Date(Date.now() - days * 86_400_000) });
    }
    const q = f.search?.trim();
    if (q) {
      qb.andWhere(
        `(c.numero ILIKE :q OR comp.companyName ILIKE :q OR cli.fullName ILIKE :q
          OR c.prenomLivraison ILIKE :q OR c.nomLivraison ILIKE :q OR c.telephoneLivraison ILIKE :q)`,
        { q: `%${q.replace(/[%_\\]/g, m => `\\${m}`)}%` },
      );
    }
  }

  /** Base commune de la liste : jointures légères (noms seulement) + périmètre de zone. */
  private baseListQb(cond: { sql: string; params: Record<string, string[]> }): SelectQueryBuilder<Commande> {
    return this.commandeRepo.createQueryBuilder('c')
      .leftJoin('c.company', 'comp').addSelect(['comp.id', 'comp.companyName'])
      .leftJoin('c.livreur', 'liv').addSelect(['liv.id', 'liv.fullName'])
      .leftJoin('c.client',  'cli').addSelect(['cli.id', 'cli.fullName'])
      .where(cond.sql, cond.params);
  }

  /** Les relations ManyToOne de Commande sont typées `Promise<X> | X` (chargement différé) :
   *  une jointure QueryBuilder les remplit, mais on doit les `await` pour lire la valeur. */
  private async rel<T>(v: T | Promise<T> | null | undefined): Promise<T | null> {
    return (await v) ?? null;
  }

  private clientName(c: Commande, cliFullName?: string | null): string {
    const livraison = `${c.prenomLivraison ?? ''} ${c.nomLivraison ?? ''}`.trim();
    return cliFullName?.trim() || livraison || 'Client';
  }

  // ════════════════════════════════════════════════════════════
  // COMMANDES
  // ════════════════════════════════════════════════════════════

  /**
   * Commandes de la zone, paginées (plus récentes d'abord), avec filtres
   * onglet / recherche / période. Les statistiques (cartes du haut) portent
   * sur TOUTE la zone, indépendamment des filtres et de la page affichée.
   */
  async getCommandes(userId: string, filters: CommandeFilters = {}, page = 1, limit = 20) {
    const scope = await this.scopeOf(userId);
    const cond  = this.scopeCondition(scope);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage  = Math.max(page, 1);

    const emptyStats = { total: 0, livrees: 0, tauxReussite: 0, enCours: 0, litiges: 0, annulees: 0, volumeLivre: 0 };
    if (!cond) return { list: [], stats: emptyStats, page: safePage, limit: safeLimit, total: 0, zoneVide: true };

    const listQb = this.baseListQb(cond).orderBy('c.createdAt', 'DESC');
    this.applyFilters(listQb, filters);

    const [rows, listTotal, statRows] = await Promise.all([
      listQb.clone().skip((safePage - 1) * safeLimit).take(safeLimit).getMany(),
      listQb.clone().getCount(),
      /* Une seule requête groupée pour toutes les cartes */
      this.commandeRepo.createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(*)', 'n')
        .addSelect('COALESCE(SUM(c.total), 0)', 'v')
        .where(cond.sql, cond.params)
        .groupBy('c.status')
        .getRawMany<{ status: CommandeStatus; n: string; v: string }>(),
    ]);

    const by = new Map(statRows.map(r => [r.status, { n: Number(r.n), v: Number(r.v) }]));
    const count = (sts: CommandeStatus[]) => sts.reduce((s, k) => s + (by.get(k)?.n ?? 0), 0);
    const total   = statRows.reduce((s, r) => s + Number(r.n), 0);
    const livrees = count(TAB_STATUSES.livrees);
    const stats = {
      total,
      livrees,
      tauxReussite: total > 0 ? Math.round((livrees / total) * 100) : 0,
      enCours:      count([CommandeStatus.IN_PROGRESS, CommandeStatus.AWAITING_CLIENT]),
      litiges:      count(TAB_STATUSES.litiges),
      annulees:     count(TAB_STATUSES.annulees),
      volumeLivre:  TAB_STATUSES.livrees.reduce((s, k) => s + (by.get(k)?.v ?? 0), 0),
    };

    /* Chaîne de validation réelle (codes validés / codes attendus) de la page */
    const chain = new Map<string, { valides: number; total: number }>();
    if (rows.length) {
      const codeRows = await this.commandeRepo.manager.createQueryBuilder()
        .select('cc.commandeId', 'cid')
        .addSelect('COUNT(*)', 'total')
        .addSelect(`SUM(CASE WHEN cc.status = 'validated' THEN 1 ELSE 0 END)`, 'valides')
        .from(CommandeCode, 'cc')
        .where('cc.commandeId IN (:...ids)', { ids: rows.map(r => r.id) })
        .groupBy('cc.commandeId')
        .getRawMany<{ cid: string; total: string; valides: string }>()
        .catch(() => []);
      for (const r of codeRows) chain.set(r.cid, { valides: Number(r.valides), total: Number(r.total) });
    }

    const fmt = (d: Date) =>
      new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    const list = await Promise.all(rows.map(async c => {
      const [client, company, livreur] = await Promise.all([this.rel(c.client), this.rel(c.company), this.rel(c.livreur)]);
      const ch = chain.get(c.id);
      return {
        uuid:        c.id,
        id:          c.numero ?? `#${c.id.slice(0, 8).toUpperCase()}`,
        quand:       fmt(c.createdAt),
        createdAt:   new Date(c.createdAt).toISOString(),
        client:      this.clientName(c, client?.fullName),
        entreprise:  company?.companyName ?? '—',
        livreur:     livreur?.fullName ?? null,
        montant:     Number(c.total) || 0,
        chaine:      ch ?? { valides: this.toProg(c.status) - 1, total: 4 },
        statut:      this.toSt(c.status),
      };
    }));

    return { list, stats, page: safePage, limit: safeLimit, total: listTotal, zoneVide: false };
  }

  /** Export : mêmes filtres que la liste, sans pagination (plafonné à 2 000 lignes). */
  async exportCommandes(userId: string, filters: CommandeFilters = {}) {
    const first = await this.getCommandes(userId, filters, 1, 100);
    const all   = [...first.list];
    const pages = Math.min(Math.ceil(first.total / 100), 20);
    for (let p = 2; p <= pages; p++) all.push(...(await this.getCommandes(userId, filters, p, 100)).list);
    return { list: all };
  }

  /**
   * Détail d'une commande de la zone : montants, livraison, articles, acteurs
   * (avec ceux qui appartiennent à la zone de l'admin) et chaîne de validation.
   * Les codes secrets ne sont JAMAIS renvoyés — uniquement leur état.
   */
  async getCommandeDetail(userId: string, commandeId: string) {
    const scope = await this.scopeOf(userId);
    const cond  = this.scopeCondition(scope);
    if (!cond) throw new NotFoundException('Commande introuvable dans votre zone.');

    const c = await this.commandeRepo.createQueryBuilder('c')
      .leftJoin('c.company',       'comp').addSelect(['comp.id', 'comp.companyName'])
      .leftJoin('c.livreur',       'liv').addSelect(['liv.id', 'liv.fullName'])
      .leftJoin('c.correspondant', 'cor').addSelect(['cor.id', 'cor.fullName'])
      .leftJoin('c.partenaire',    'par').addSelect(['par.id', 'par.name'])
      .leftJoin('c.client',        'cli').addSelect(['cli.id', 'cli.fullName'])
      .leftJoinAndSelect('c.items', 'it')
      .leftJoin('c.codes', 'cd').addSelect(['cd.id', 'cd.acteurType', 'cd.acteurNom', 'cd.ordre', 'cd.status', 'cd.validatedAt', 'cd.expiresAt'])
      .where('c.id = :id', { id: commandeId })
      .andWhere(cond.sql, cond.params)
      .getOne();
    if (!c) throw new NotFoundException('Commande introuvable dans votre zone.');

    const [client, company, livreur, correspondant, partenaire] = await Promise.all([
      this.rel(c.client), this.rel(c.company), this.rel(c.livreur), this.rel(c.correspondant), this.rel(c.partenaire),
    ]);
    const acteurs = [
      company       && { role: 'Entreprise',    nom: company.companyName,       dansZone: scope.cids.includes(company.id) },
      livreur       && { role: 'Livreur',       nom: livreur.fullName,          dansZone: scope.dids.includes(livreur.id) },
      correspondant && { role: 'Correspondant', nom: correspondant.fullName,    dansZone: false },
      partenaire    && { role: 'Partenaire',    nom: partenaire.name,           dansZone: scope.pids.includes(partenaire.id) },
    ].filter(Boolean);

    return {
      uuid:     c.id,
      numero:   c.numero,
      statut:   this.toSt(c.status),
      createdAt: c.createdAt,
      datePaiement:           c.datePaiement,
      dateLivraisonEstimee:   c.datelivraisonEstimee,
      dateLivraisonEffective: c.dateLivraisonEffective,
      autoValidationAt:       c.autoValidationAt,
      modeLivraison:          c.modeLivraison,
      methodePaiement:        c.methodePaiement,
      montants: {
        sousTotal:       Number(c.sousTotal)       || 0,
        fraisLivraison:  Number(c.fraisLivraison)  || 0,
        commissionShopi: Number(c.commissionShopi) || 0,
        total:           Number(c.total)           || 0,
      },
      client: {
        nom:       this.clientName(c, client?.fullName),
        telephone: c.telephoneLivraison,
      },
      livraison: {
        ville: c.villeLivraison, commune: c.communeLivraison,
        adresse: c.adresseLivraison, notes: c.notesClient,
      },
      acteurs,
      articles: (c.items ?? []).map(i => ({
        nom: i.nomProduit, variante: i.varianteChoisie,
        quantite: i.quantite, prixUnitaire: Number(i.prixUnitaire) || 0, sousTotal: Number(i.sousTotal) || 0,
      })),
      chaine: (c.codes ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map(k => ({
          ordre: k.ordre, acteurType: k.acteurType, acteurNom: k.acteurNom,
          statut: k.status, validatedAt: k.validatedAt, expiresAt: k.expiresAt,
        })),
    };
  }

  // ════════════════════════════════════════════════════════════
  // FINANCES
  // ════════════════════════════════════════════════════════════

  /**
   * Retourne les données financières de la zone :
   *
   *  • chart  — volume (M GNF) et commissions admin (×0,1M)
   *             sur les 5 derniers mois, par mois calendaire
   *
   *  • flux   — 8 dernières distributions admin (produit + livraison)
   *             avec sens du flux (in / out / refund) et montant signé
   */
  async getFinances(userId: string) {
    const admin = await this.zoneService.adminOf(userId);
    const cids  = await this.zoneService.companyIds(admin.id);
    const now   = new Date();

    // ── Graphe mensuel (5 derniers mois) ──────────────────────
    // Optimisation : avant, 5 itérations séquentielles × 2 requêtes
    // (10 allers-retours DB) ; maintenant, 2 requêtes GROUP BY
    // DATE_TRUNC('month', ...) pour toute la période — même principe
    // que daySlice/weekSlice/quarterSlice dans admin-overview.service.ts.
    const from = new Date(now.getFullYear(), now.getMonth() - 4, 1);

    const [volRows, comRows] = await Promise.all([
      cids.length
        ? this.commandeRepo.createQueryBuilder('c')
            .select("DATE_TRUNC('month', c.createdAt)", 'period')
            .addSelect('COALESCE(SUM(CAST(c.total AS DECIMAL)), 0)', 'v')
            .where('c.companyId IN (:...cids)', { cids })
            .andWhere('c.status IN (:...ok)', {
              ok: [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED],
            })
            .andWhere('c.createdAt >= :from', { from })
            .groupBy("DATE_TRUNC('month', c.createdAt)")
            .getRawMany()
            .catch(() => [])
        : Promise.resolve([]),

      this.distRepo.createQueryBuilder('pd')
        .select("DATE_TRUNC('month', pd.createdAt)", 'period')
        .addSelect('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'v')
        .where('pd.acteurType IN (:...types)', {
          types: [DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON],
        })
        .andWhere('pd.status = :distStatus', { distStatus: DistributionStatus.RELEASED })
        .andWhere('pd.adminUserId = :aid', { aid: userId })
        .andWhere('pd.createdAt >= :from', { from })
        .groupBy("DATE_TRUNC('month', pd.createdAt)")
        .getRawMany()
        .catch(() => []),
    ]);

    const toMonthMap = (rows: { period: Date | string; v: string }[]) =>
      new Map<string, number>(
        rows.map(r => [new Date(r.period).toISOString().slice(0, 7), +r.v] as [string, number]),
      );
    const volMap = toMonthMap(volRows);
    const comMap = toMonthMap(comRows);

    const chart: { x: string; a: number; c: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      chart.push({
        x: MONTHS_FR[d.getMonth()],
        a: Math.round((volMap.get(key) ?? 0) / 1_000_000),  // converti en M GNF
        c: Math.round((comMap.get(key) ?? 0) / 100_000),     // converti en ×0,1M GNF
      });
    }

    // ── Flux financiers récents ───────────────────────────────
    const recentDist = await this.distRepo.find({
      where: {
        acteurType:  In([DistributionActeurType.ADMIN_PRODUIT, DistributionActeurType.ADMIN_LIVRAISON]),
        adminUserId: userId,
      },
      order: { createdAt: 'DESC' },
      take: 8,
    });

    const flux = recentDist.map(d => ({
      id:  d.id,
      // RELEASED = entrée (in), CANCELLED = sortie (out), REFUNDED = remboursement
      sens: d.status === DistributionStatus.REFUNDED  ? 'refund'
          : d.status === DistributionStatus.CANCELLED ? 'out' : 'in',
      libelle: `Commission admin sur <b>${d.commandeNumero}</b>`,
      quand:   relTime(d.createdAt),
      // Montant négatif pour les flux sortants
      montant: (d.status === DistributionStatus.REFUNDED || d.status === DistributionStatus.CANCELLED)
             ? -d.montant : d.montant,
    }));

    return { chart, flux };
  }
}
