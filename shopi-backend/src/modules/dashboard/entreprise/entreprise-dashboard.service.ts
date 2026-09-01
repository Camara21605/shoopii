/* ============================================================
 * FICHIER  : src/modules/dashboard/entreprise/entreprise-dashboard.service.ts
 * RÔLE     : Vue d'ensemble, analytics et finances réelles de
 *            l'entreprise connectée — tout est dérivé des
 *            commandes/produits/avis/wallet de CETTE entreprise
 *            (jamais de données inventées).
 * ============================================================ */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Company } from '../../../database/entities/profiles/entreprise-profile.entity';
import { Commande, CommandeStatus } from '../../../database/entities/commande/commande.entity';
import { CommandeItem } from '../../../database/entities/commande/commande-item.entity';
import { Client } from '../../../database/entities/profiles/client-profile.entity';
import { Delivery } from '../../../database/entities/profiles/livreur-profile.entity';
import { Product } from '../../../database/entities/entreprise.table/product.entity';
import { Category } from '../../../database/entities/entreprise.table/category.entity';
import { CompanyAvis } from '../../../database/entities/entreprise.table/company-avis.entity';
import { Follow, TargetActorType } from '../../../database/entities/follow/follow.entity';
import { ReturnRequest, ReturnStatus } from '../../../database/entities/returns/return-request.entity';
import { Wallet, WalletType } from '../../../database/entities/wallet.entity';
import { WalletLedgerEntry, LedgerEntryDirection } from '../../../database/entities/wallet-ledger-entry.entity';
import { WalletOperationType } from '../../../database/entities/wallet-transaction.entity';

import { mapOrderStatus } from '../../commande/services/commande.helpers';

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const DELIVERED_STATUSES = [CommandeStatus.DELIVERED, CommandeStatus.AUTO_DELIVERED];

@Injectable()
export class EntrepriseDashboardService {

  constructor(
    @InjectRepository(Company)      private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Commande)     private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(CommandeItem) private readonly itemRepo:     Repository<CommandeItem>,
    @InjectRepository(Client)       private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Delivery)     private readonly deliveryRepo: Repository<Delivery>,
    @InjectRepository(Product)      private readonly productRepo:  Repository<Product>,
    @InjectRepository(CompanyAvis)  private readonly avisRepo:     Repository<CompanyAvis>,
    @InjectRepository(Follow)       private readonly followRepo:   Repository<Follow>,
    @InjectRepository(ReturnRequest) private readonly returnRepo:  Repository<ReturnRequest>,
    @InjectRepository(Wallet)       private readonly walletRepo:   Repository<Wallet>,
    @InjectRepository(WalletLedgerEntry) private readonly ledgerRepo: Repository<WalletLedgerEntry>,
  ) {}

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/entreprise/overview
  // ══════════════════════════════════════════════════════════════

  async getOverview(companyId: string) {
    const company = await this.resolveCompany(companyId);
    if (!company) return this.emptyOverview();

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      commandes, avisStats, followCount, returnsThisMonth,
      caData, topProduits, categoryBreakdown, dernieresCommandes, stockAlertes,
    ] = await Promise.all([
      this.commandeRepo.find({ where: { companyId: company.id }, select: ['id', 'status', 'sousTotal', 'commissionShopi', 'total', 'createdAt', 'updatedAt'] }),
      this.avisStats(company.id),
      this.followRepo.count({ where: { targetType: TargetActorType.COMPANY, targetId: company.id, isSubscribed: true } }),
      this.returnsBreakdown(company.id, monthStart),
      this.monthlyCA(company.id, 6),
      this.topProduits(company.id, 5),
      this.categoryBreakdown(company.id),
      this.derniereCommandes(company.id, 4),
      this.stockAlertes(company.id),
    ]);

    const commandesCeMois = commandes.filter(c => c.createdAt >= monthStart);
    const commandesMoisDernier = commandes.filter(c => c.createdAt >= lastMonthStart && c.createdAt < monthStart);

    const sumSousTotal = (rows: Commande[]) => rows.reduce((s, c) => s + Number(c.sousTotal), 0);
    const sumCommission = (rows: Commande[]) => rows.reduce((s, c) => s + Number(c.commissionShopi), 0);

    const caCeMois     = sumSousTotal(commandesCeMois.filter(c => DELIVERED_STATUSES.includes(c.status)));
    const caMoisDernier = sumSousTotal(commandesMoisDernier.filter(c => DELIVERED_STATUSES.includes(c.status)));
    const croissanceCA = caMoisDernier > 0 ? Math.round(((caCeMois - caMoisDernier) / caMoisDernier) * 100) : 0;

    const commissionCeMois = sumCommission(commandesCeMois.filter(c => DELIVERED_STATUSES.includes(c.status)));
    const beneficeNet = caCeMois - commissionCeMois;
    const margePct = caCeMois > 0 ? Math.round((beneficeNet / caCeMois) * 100) : 0;

    const enAttente = commandesCeMois.filter(c => mapOrderStatus(c.status) === 'new').length;
    const enCours   = commandesCeMois.filter(c => mapOrderStatus(c.status) === 'prep' || mapOrderStatus(c.status) === 'ship').length;
    const livrees   = commandesCeMois.filter(c => DELIVERED_STATUSES.includes(c.status)).length;

    return {
      zoneNom: company.companyName,
      kpis: {
        caCeMois, croissanceCA,
        commandesCeMois: commandesCeMois.length,
        commandesCroissance: commandesMoisDernier.length > 0
          ? Math.round(((commandesCeMois.length - commandesMoisDernier.length) / commandesMoisDernier.length) * 100)
          : 0,
        enAttente, enCours, livrees,
        noteMoyenne: avisStats.moyenne,
        totalAvis: avisStats.total,
        abonnes: followCount,
        retoursCeMois: returnsThisMonth.total,
        retoursEnTraitement: returnsThisMonth.enTraitement,
        retoursRembourses: returnsThisMonth.rembourses,
        beneficeNet, margePct, commissionCeMois,
      },
      caData,
      topProduits,
      categoryBreakdown,
      dernieresCommandes,
      stockAlertes,
      activite: this.buildActivite(dernieresCommandes, avisStats.dernierAvis),
    };
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/entreprise/analytics
  // ══════════════════════════════════════════════════════════════

  async getAnalytics(companyId: string) {
    const company = await this.resolveCompany(companyId);
    if (!company) return { caData: [], topProduits: [], categoryPerf: [] };

    const [caData, topProduits, categoryPerf] = await Promise.all([
      this.monthlyCA(company.id, 6),
      this.topProduits(company.id, 5),
      this.categoryPerformance(company.id),
    ]);

    return { caData, topProduits, categoryPerf };
  }

  // ══════════════════════════════════════════════════════════════
  // GET /dashboard/entreprise/finances
  // ══════════════════════════════════════════════════════════════

  async getFinances(companyId: string) {
    const company = await this.resolveCompany(companyId);
    if (!company) return this.emptyFinances();

    const wallet = await this.walletRepo.findOne({
      where: { userId: company.userId, walletType: WalletType.ENTREPRISE },
    });

    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [commandesCeMois, commandesMoisDernier, caData, ledgerEntries] = await Promise.all([
      this.commandeRepo.find({
        where: { companyId: company.id },
        select: ['id', 'status', 'sousTotal', 'fraisLivraison', 'commissionShopi', 'createdAt'],
      }).then(rows => rows.filter(c => c.createdAt >= monthStart)),
      this.commandeRepo.find({
        where: { companyId: company.id },
        select: ['id', 'status', 'sousTotal', 'createdAt'],
      }).then(rows => rows.filter(c => c.createdAt >= lastMonthStart && c.createdAt < monthStart)),
      this.monthlyCA(company.id, 6),
      wallet ? this.ledgerRepo.find({ where: { walletId: wallet.id }, order: { createdAt: 'DESC' }, take: 30 }) : Promise.resolve([]),
    ]);

    const delivered = commandesCeMois.filter(c => DELIVERED_STATUSES.includes(c.status));
    const ventes      = delivered.reduce((s, c) => s + Number(c.sousTotal), 0);
    const livraisons  = delivered.reduce((s, c) => s + Number(c.fraisLivraison), 0);
    const commissions = delivered.reduce((s, c) => s + Number(c.commissionShopi), 0);
    const revenusMois = ventes;
    const depensesMois = commissions + livraisons;

    const deliveredLastMonth = commandesMoisDernier.filter(c => DELIVERED_STATUSES.includes(c.status));
    const revenusMoisDernier = deliveredLastMonth.reduce((s, c) => s + Number(c.sousTotal), 0);
    const croissanceRevenus  = revenusMoisDernier > 0
      ? Math.round(((revenusMois - revenusMoisDernier) / revenusMoisDernier) * 100)
      : 0;

    const transactions = ledgerEntries.map(e => ({
      id:          e.id,
      description: e.description ?? 'Mouvement wallet',
      reference:   e.reference,
      montant:     e.direction === LedgerEntryDirection.CREDIT ? Number(e.credit) : -Number(e.debit),
      dir:         e.direction === LedgerEntryDirection.CREDIT ? 'in' as const : 'out' as const,
      date:        e.createdAt,
    }));

    const virements = ledgerEntries
      .filter(e => e.operationType === WalletOperationType.WITHDRAWAL_INIT || e.operationType === WalletOperationType.WITHDRAWAL_CONFIRM)
      .map(e => ({
        id:      e.id,
        montant: Number(e.credit || e.debit),
        statut:  e.operationType === WalletOperationType.WITHDRAWAL_CONFIRM ? 'done' as const : 'pending' as const,
        date:    e.createdAt,
      }));

    const totalFlux = ventes + livraisons + commissions;
    const repartition = totalFlux > 0 ? [
      { label: 'Ventes produits',     montant: ventes,      pct: Math.round((ventes / totalFlux) * 100) },
      { label: 'Livraisons facturées', montant: livraisons,  pct: Math.round((livraisons / totalFlux) * 100) },
      { label: 'Commissions Shopi',   montant: -commissions, pct: -Math.round((commissions / totalFlux) * 100) },
    ] : [];

    return {
      solde:          Number(wallet?.balance ?? 0),
      soldeEnAttente: Number(wallet?.pendingBalance ?? 0),
      revenusMois, depensesMois, croissanceRevenus,
      caData,
      transactions,
      virements,
      repartition,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Helpers privés partagés
  // ══════════════════════════════════════════════════════════════

  /**
   * Résout l'entreprise par son ID de profil (Company.id) — PAS par
   * userId. Avant : { where: { userId } } ne trouvait l'entreprise QUE
   * pour son propriétaire (Company.userId), jamais pour un collaborateur
   * (qui n'a pas d'entité Company propre, voir CompanyTeamMember). Le
   * contrôleur passe maintenant req.user.actorId — déjà résolu au login
   * vers le bon companyId pour le propriétaire COMME pour ses
   * collaborateurs (voir AuthService.findProfileId) — donc un simple
   * lookup par id suffit ici, pour les deux cas. Sans ce correctif,
   * overview/analytics/finances étaient TOUJOURS vides pour tout
   * collaborateur, quelles que soient ses permissions. */
  private async resolveCompany(companyId: string): Promise<Company | null> {
    return this.companyRepo.findOne({ where: { id: companyId } });
  }

  /** CA mensuel réel des N derniers mois (Millions GNF, commandes livrées). */
  private async monthlyCA(companyId: string, months: number) {
    const now  = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const rows = await this.commandeRepo
      .createQueryBuilder('c')
      .select("DATE_TRUNC('month', c.createdAt)", 'period')
      .addSelect('COALESCE(SUM(CAST(c.sousTotal AS DECIMAL)), 0)', 'v')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: DELIVERED_STATUSES })
      .andWhere('c.createdAt >= :from', { from })
      .groupBy("DATE_TRUNC('month', c.createdAt)")
      .getRawMany()
      .catch(() => [] as any[]);

    const map = new Map(rows.map((r): [string, number] => [new Date(r.period).toISOString().slice(0, 7), +r.v]));

    const result: { m: string; v: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      result.push({ m: MONTH_LABELS[d.getMonth()], v: Math.round((map.get(key) ?? 0) / 1_000_000) });
    }
    return result;
  }

  /** Top produits par ventes réelles, avec tendance vs mois précédent. */
  private async topProduits(companyId: string, limit: number) {
    const now = new Date();
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(Commande, 'c', 'c.id = i.commandeId')
      .select('COALESCE(i.productId::text, i.nomProduit)', 'key')
      .addSelect('i.nomProduit', 'nomProduit')
      .addSelect('i.productId', 'productId')
      .addSelect('SUM(i.quantite)', 'ventes')
      .addSelect('SUM(CAST(i.sousTotal AS DECIMAL))', 'ca')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: DELIVERED_STATUSES })
      .groupBy('key, i.nomProduit, i.productId')
      .orderBy('ventes', 'DESC')
      .limit(limit)
      .getRawMany()
      .catch(() => [] as any[]);

    if (!rows.length) return [];

    const productIds = rows.map(r => r.productId).filter(Boolean);
    // Product.category n'est plus eager (voir product.entity.ts) — déclarée
    // explicitement car category.icone est lu plus bas (ligne ~308).
    const products = productIds.length
      ? await this.productRepo.find({ where: { id: In(productIds) }, relations: ['category'] })
      : [];
    const productMap = new Map(products.map(p => [p.id, p]));

    // Tendance vs mois précédent (qty vendue ce mois vs mois dernier)
    const trendRows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(Commande, 'c', 'c.id = i.commandeId')
      .select('i.productId', 'productId')
      .addSelect(`SUM(CASE WHEN c.createdAt >= :monthStart THEN i.quantite ELSE 0 END)`, 'ceMois')
      .addSelect(`SUM(CASE WHEN c.createdAt >= :lastMonthStart AND c.createdAt < :monthStart THEN i.quantite ELSE 0 END)`, 'moisDernier')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: DELIVERED_STATUSES })
      .andWhere('i.productId IN (:...productIds)', { productIds: productIds.length ? productIds : ['00000000-0000-0000-0000-000000000000'] })
      .setParameters({ monthStart, lastMonthStart, companyId, statuses: DELIVERED_STATUSES })
      .groupBy('i.productId')
      .getRawMany()
      .catch(() => [] as any[]);
    const trendMap = new Map(trendRows.map((r): [string, { ceMois: number; moisDernier: number }] =>
      [r.productId, { ceMois: +r.ceMois, moisDernier: +r.moisDernier }]));

    return rows.map(r => {
      const product  = r.productId ? productMap.get(r.productId) : undefined;
      const category = product?.category;
      const trend    = r.productId ? trendMap.get(r.productId) : undefined;
      const direction: 'up' | 'dn' | 'neu' = !trend || trend.moisDernier === trend.ceMois
        ? 'neu'
        : trend.ceMois > trend.moisDernier ? 'up' : 'dn';

      return {
        em:     category?.icone ?? '📦',
        nm:     r.nomProduit,
        ventes: +r.ventes,
        ca:     `${(+r.ca / 1_000_000).toFixed(1)}M GNF`,
        trend:  direction,
      };
    });
  }

  /** Répartition des ventes par catégorie (donut). */
  private async categoryBreakdown(companyId: string) {
    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(Commande, 'c', 'c.id = i.commandeId')
      .innerJoin(Product, 'p', 'p.id = i.productId')
      .innerJoin(Category, 'cat', 'cat.id = p.categoryId')
      .select('cat.nom', 'nom')
      .addSelect('SUM(CAST(i.sousTotal AS DECIMAL))', 'ca')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: DELIVERED_STATUSES })
      .groupBy('cat.nom')
      .orderBy('ca', 'DESC')
      .limit(6)
      .getRawMany()
      .catch(() => [] as any[]);

    const total = rows.reduce((s, r) => s + +r.ca, 0);
    if (total === 0) return [];

    return rows.map(r => ({
      label: r.nom as string,
      pct:   Math.round((+r.ca / total) * 100),
    }));
  }

  /** Performances par catégorie (CA + nb commandes réels — pas de taux de conversion, aucun tracking trafic). */
  private async categoryPerformance(companyId: string) {
    const rows = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoin(Commande, 'c', 'c.id = i.commandeId')
      .innerJoin(Product, 'p', 'p.id = i.productId')
      .innerJoin(Category, 'cat', 'cat.id = p.categoryId')
      .select('cat.nom', 'cat')
      .addSelect('SUM(CAST(i.sousTotal AS DECIMAL))', 'ca')
      .addSelect('COUNT(DISTINCT c.id)', 'commandes')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: DELIVERED_STATUSES })
      .groupBy('cat.nom')
      .orderBy('ca', 'DESC')
      .limit(8)
      .getRawMany()
      .catch(() => [] as any[]);

    return rows.map(r => ({
      cat:      r.cat as string,
      ca:       +(+r.ca / 1_000_000).toFixed(1),
      commandes: +r.commandes,
    }));
  }

  /** Produits sous le seuil d'alerte (stock <= seuil), les plus critiques d'abord. */
  private async stockAlertes(companyId: string) {
    const products = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category')
      .where('p.companyId = :companyId', { companyId })
      .andWhere('p.seuil IS NOT NULL')
      .andWhere('p.stock <= p.seuil')
      .orderBy('p.stock', 'ASC')
      .limit(10)
      .getMany();

    return products.map(p => ({
      em:   p.category?.icone ?? '📦',
      nm:   p.nom,
      qty:  p.stock,
      min:  p.seuil ?? 0,
      type: p.stock === 0 ? ('red' as const) : (p.stock <= (p.seuil ?? 0) / 2 ? ('red' as const) : ('amber' as const)),
    }));
  }

  /** 4 dernières commandes réelles, même mapping que /entreprise/commandes. */
  private async derniereCommandes(companyId: string, take: number) {
    const commandes = await this.commandeRepo.find({
      where: { companyId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      take,
    });
    if (!commandes.length) return [];

    const clientIds  = [...new Set(commandes.map(c => c.clientId))];
    const livreurIds = [...new Set(commandes.map(c => c.livreurId).filter((id): id is string => !!id))];

    const [clients, deliveries] = await Promise.all([
      this.clientRepo.find({ where: { id: In(clientIds) } }),
      livreurIds.length ? this.deliveryRepo.find({ where: { id: In(livreurIds) } }) : Promise.resolve([]),
    ]);
    const clientMap   = new Map(clients.map(c => [c.id, c.fullName ?? 'Client']));
    const deliveryMap = new Map(deliveries.map(d => [d.id, d.fullName]));

    return commandes.map(c => {
      const firstItem = c.items?.[0];
      return {
        id:      c.numero,
        uuid:    c.id,
        em:      '📦',
        nm:      firstItem?.nomProduit ?? 'Commande',
        vt:      firstItem?.varianteChoisie ?? '',
        client:  clientMap.get(c.clientId) ?? 'Client',
        price:   +c.total,
        status:  mapOrderStatus(c.status),
        date:    c.createdAt.toISOString(),
        livreur: c.livreurId ? (deliveryMap.get(c.livreurId) ?? '—') : '—',
        zone:    c.communeLivraison ?? '—',
      };
    });
  }

  /** Note moyenne + total avis réels + dernier avis (pour l'activité récente). */
  private async avisStats(companyId: string) {
    const avis = await this.avisRepo.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    if (!avis.length) return { moyenne: 0, total: 0, dernierAvis: null as CompanyAvis | null };

    const moyenne = avis.reduce((s, a) => s + a.note, 0) / avis.length;
    return { moyenne: +moyenne.toFixed(1), total: avis.length, dernierAvis: avis[0] };
  }

  /** Retours du mois + répartition en traitement / remboursés. */
  private async returnsBreakdown(companyId: string, monthStart: Date) {
    const rows = await this.returnRepo.find({
      where: { companyId },
      select: ['id', 'status', 'createdAt'],
    });
    const thisMonth = rows.filter(r => r.createdAt >= monthStart);
    return {
      total:         thisMonth.length,
      enTraitement:  thisMonth.filter(r => r.status === ReturnStatus.PENDING || r.status === ReturnStatus.ACCEPTED).length,
      rembourses:    thisMonth.filter(r => r.status === ReturnStatus.REFUNDED).length,
    };
  }

  /** Activité récente réelle : dernières commandes + dernier avis. */
  private buildActivite(
    dernieresCommandes: Awaited<ReturnType<EntrepriseDashboardService['derniereCommandes']>>,
    dernierAvis: CompanyAvis | null,
  ) {
    const items: { icon: string; txt: string; time: string }[] = [];

    for (const c of dernieresCommandes.slice(0, 3)) {
      items.push({
        icon: 'fa-box',
        txt:  `<strong>Commande</strong> ${c.id} — ${c.nm}`,
        time: c.date,
      });
    }

    if (dernierAvis) {
      items.push({
        icon: 'fa-star',
        txt:  `<strong>Avis ${dernierAvis.note}★</strong> reçu de ${dernierAvis.clientNom}`,
        time: dernierAvis.createdAt.toISOString(),
      });
    }

    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5)
      .map(i => ({ ...i, time: this.relTime(new Date(i.time)) }));
  }

  private relTime(d: Date): string {
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1)  return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    if (h < 24) return `Il y a ${h}h`;
    return `Il y a ${Math.floor(h / 24)}j`;
  }

  private emptyOverview() {
    return {
      zoneNom: 'Boutique',
      kpis: {
        caCeMois: 0, croissanceCA: 0, commandesCeMois: 0, commandesCroissance: 0,
        enAttente: 0, enCours: 0, livrees: 0, noteMoyenne: 0, totalAvis: 0,
        abonnes: 0, retoursCeMois: 0, retoursEnTraitement: 0, retoursRembourses: 0,
        beneficeNet: 0, margePct: 0, commissionCeMois: 0,
      },
      caData: [], topProduits: [], categoryBreakdown: [], dernieresCommandes: [],
      stockAlertes: [], activite: [],
    };
  }

  private emptyFinances() {
    return {
      solde: 0, soldeEnAttente: 0, revenusMois: 0, depensesMois: 0, croissanceRevenus: 0,
      caData: [], transactions: [], virements: [], repartition: [],
    };
  }
}
