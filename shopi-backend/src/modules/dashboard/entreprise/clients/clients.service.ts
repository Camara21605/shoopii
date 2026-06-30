/* ============================================================
 * FICHIER : src/modules/dashboard/entreprise/clients/clients.service.ts
 *
 * RÔLE : Récupère et segmente tous les clients d'une entreprise.
 *
 * SOURCES DE DONNÉES :
 *   1. Table `commandes`  → clients qui ont ACHETÉ au moins une fois
 *   2. Table `follows`    → clients qui SUIVENT la boutique
 *   On fusionne les deux sources pour éviter les doublons.
 *
 * SEGMENTS :
 *   VIP       → totalSpent ≥ 10 000 000 GNF OU totalOrders ≥ 10
 *   Fidèle    → totalOrders ≥ 5
 *   Régulier  → totalOrders ≥ 2
 *   Nouveau   → totalOrders = 1
 *   Abonné    → isSuivi = true, totalOrders = 0 (jamais acheté)
 * ============================================================ */

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository }   from '@nestjs/typeorm';
import { Repository, In }     from 'typeorm';

import { Company }     from 'src/database/entities/profiles/entreprise-profile.entity';
import { Client }      from 'src/database/entities/profiles/client-profile.entity';
import { Commande, CommandeStatus } from 'src/database/entities/commande/commande.entity';
import { Follow, FollowStatus, TargetActorType, FollowerActorType }
  from 'src/database/entities/follow/follow.entity';
import { User }        from 'src/database/entities/user.entity';

export type ClientSegment = 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné';

export interface ClientRow {
  id:             string;  // Client profile id
  userId:         string;
  fullName:       string;
  email:          string;
  profilePicture: string | null;
  totalOrders:    number;
  totalSpent:     number;  // GNF
  lastOrderAt:    Date | null;
  isSuivi:        boolean;
  segment:        ClientSegment;
  createdAt:      Date;
}

export interface ClientsFilters {
  search?:  string;
  segment?: ClientSegment | 'all';
  source?:  'buyers' | 'abonnes' | 'all';
  page?:    number;
  limit?:   number;
  sortBy?:  'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ClientsResult {
  data:  ClientRow[];
  total: number;
  page:  number;
  pages: number;
  stats: {
    total:       number;
    buyers:      number;
    abonnes:     number;
    vip:         number;
    fideles:     number;
    reguliers:   number;
    nouveaux:    number;
    caTotal:     number;
    panierMoyen: number;
  };
}

/* ── Seuils de segmentation ── */
const SEUILS = {
  VIP_SPENT:    10_000_000,  // GNF
  VIP_ORDERS:   10,
  FIDELE:       5,
  REGULIER:     2,
};

function calcSegment(totalOrders: number, totalSpent: number, isSuivi: boolean): ClientSegment {
  if (totalOrders === 0) return 'Abonné';
  if (totalSpent >= SEUILS.VIP_SPENT || totalOrders >= SEUILS.VIP_ORDERS) return 'VIP';
  if (totalOrders >= SEUILS.FIDELE)   return 'Fidèle';
  if (totalOrders >= SEUILS.REGULIER) return 'Régulier';
  return 'Nouveau';
}

/* ══════════════════════════════════════════════════════════════ */

@Injectable()
export class ClientsService {

  private readonly logger = new Logger(ClientsService.name);

  /* ── Statuts de commande considérés comme "achat réel" ── */
  private readonly VALID_STATUSES = [
    CommandeStatus.DELIVERED,
    CommandeStatus.AUTO_DELIVERED,
    CommandeStatus.PAID,
    CommandeStatus.IN_PROGRESS,
    CommandeStatus.AWAITING_CLIENT,
    CommandeStatus.REFUNDED,
  ];

  constructor(
    @InjectRepository(Company)   private readonly companyRepo:  Repository<Company>,
    @InjectRepository(Client)    private readonly clientRepo:   Repository<Client>,
    @InjectRepository(Commande)  private readonly commandeRepo: Repository<Commande>,
    @InjectRepository(Follow)    private readonly followRepo:   Repository<Follow>,
    @InjectRepository(User)      private readonly userRepo:     Repository<User>,
  ) {}

  /* ══════════════════════════════════════════════════════════════
   * MÉTHODE PRINCIPALE — liste paginée + statistiques
   * ════════════════════════════════════════════════════════════ */
  async getClients(userId: string, filters: ClientsFilters): Promise<ClientsResult> {
    /* ── 1. Résoudre le profil entreprise ── */
    const company = await this.companyRepo.findOne({
      where: { userId },
      select: ['id', 'companyName'],
    });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');

    /* ── 2. Charger acheteurs et abonnés en parallèle ── */
    const [buyersMap, abonnesIds] = await Promise.all([
      this.loadBuyersMap(company.id),
      this.loadAbonnesIds(company.id),
    ]);

    /* ── 3. Fusionner les deux sources (union des clientIds) ── */
    const allClientIds = new Set([
      ...buyersMap.keys(),
      ...abonnesIds,
    ]);

    if (allClientIds.size === 0) {
      return this.emptyResult(filters.page ?? 1, filters.limit ?? 20);
    }

    /* ── 4. Charger les profils clients + userId ── */
    const clientIds = [...allClientIds];
    const clients = await this.clientRepo.find({
      where: { id: In(clientIds) },
      select: ['id', 'userId', 'totalOrders', 'totalSpent', 'createdAt'],
    });

    /* ── 5. Charger les infos User (nom, email, photo) en batch ── */
    const userIds = clients.map(c => c.userId).filter(Boolean);
    const users   = userIds.length > 0
      ? await this.userRepo.find({
          where: { id: In(userIds) },
          select: ['id', 'firstName', 'lastName', 'email', 'profilePicture'],
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));

    /* ── 6. Construire les lignes enrichies ── */
    let rows: ClientRow[] = clients.map(cl => {
      const user          = userMap.get(cl.userId);
      const buyerData     = buyersMap.get(cl.id);
      const isSuivi       = abonnesIds.has(cl.id);
      const totalOrders   = buyerData?.totalOrders   ?? 0;
      const totalSpent    = buyerData?.totalSpent    ?? 0;
      const lastOrderAt   = buyerData?.lastOrderAt   ?? null;

      return {
        id:             cl.id,
        userId:         cl.userId,
        fullName:       user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Client',
        email:          user?.email ?? '—',
        profilePicture: user?.profilePicture ?? null,
        totalOrders,
        totalSpent:     Number(totalSpent),
        lastOrderAt,
        isSuivi,
        segment:        calcSegment(totalOrders, Number(totalSpent), isSuivi),
        createdAt:      cl.createdAt,
      };
    });

    /* ── 7. Filtres appliqués en mémoire ── */

    /* Filtre source : buyers seulement ou abonnés seulement */
    if (filters.source === 'buyers') {
      rows = rows.filter(r => r.totalOrders > 0);
    } else if (filters.source === 'abonnes') {
      rows = rows.filter(r => r.isSuivi);
    }

    /* Filtre segment */
    if (filters.segment && filters.segment !== 'all') {
      rows = rows.filter(r => r.segment === filters.segment);
    }

    /* Recherche texte */
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.fullName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
      );
    }

    /* ── 8. Statistiques globales (sur l'ensemble non filtré) ── */
    const allRows = clients.map(cl => {
      const buyerData   = buyersMap.get(cl.id);
      const isSuivi     = abonnesIds.has(cl.id);
      const totalOrders = buyerData?.totalOrders ?? 0;
      const totalSpent  = Number(buyerData?.totalSpent ?? 0);
      return { totalOrders, totalSpent, isSuivi, segment: calcSegment(totalOrders, totalSpent, isSuivi) };
    });

    const caTotal     = allRows.reduce((s, r) => s + r.totalSpent, 0);
    const buyersCount = allRows.filter(r => r.totalOrders > 0).length;
    const stats = {
      total:       allClientIds.size,
      buyers:      buyersCount,
      abonnes:     abonnesIds.size,
      vip:         allRows.filter(r => r.segment === 'VIP').length,
      fideles:     allRows.filter(r => r.segment === 'Fidèle').length,
      reguliers:   allRows.filter(r => r.segment === 'Régulier').length,
      nouveaux:    allRows.filter(r => r.segment === 'Nouveau').length,
      caTotal,
      panierMoyen: buyersCount > 0 ? Math.round(caTotal / buyersCount) : 0,
    };

    /* ── 9. Tri ── */
    const sortBy    = filters.sortBy    ?? 'totalSpent';
    const sortOrder = filters.sortOrder ?? 'DESC';

    rows.sort((a, b) => {
      let diff: number;
      switch (sortBy) {
        case 'totalOrders': diff = a.totalOrders - b.totalOrders; break;
        case 'lastOrderAt':
          diff = (a.lastOrderAt?.getTime() ?? 0) - (b.lastOrderAt?.getTime() ?? 0);
          break;
        case 'createdAt':
          diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        default: diff = a.totalSpent - b.totalSpent;
      }
      return sortOrder === 'ASC' ? diff : -diff;
    });

    /* ── 10. Pagination ── */
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const total = rows.length;
    const pages = Math.ceil(total / limit);
    const data  = rows.slice((page - 1) * limit, page * limit);

    this.logger.log(
      `[CLIENTS] companyId=${company.id} → ${total} clients chargés`,
    );

    return { data, total, page, pages, stats };
  }

  /* ══════════════════════════════════════════════════════════════
   * HELPERS PRIVÉS
   * ════════════════════════════════════════════════════════════ */

  /**
   * Charge un Map<clientId, { totalOrders, totalSpent, lastOrderAt }>
   * depuis la table commandes pour une entreprise donnée.
   * Utilise GROUP BY pour éviter les N+1 queries.
   */
  private async loadBuyersMap(companyId: string): Promise<Map<string, {
    totalOrders: number;
    totalSpent:  number;
    lastOrderAt: Date | null;
  }>> {
    const rows = await this.commandeRepo
      .createQueryBuilder('c')
      .select('c.clientId', 'clientId')
      .addSelect('COUNT(c.id)', 'totalOrders')
      .addSelect('SUM(c.total)', 'totalSpent')
      .addSelect('MAX(c.createdAt)', 'lastOrderAt')
      .where('c.companyId = :companyId', { companyId })
      .andWhere('c.status IN (:...statuses)', { statuses: this.VALID_STATUSES })
      .groupBy('c.clientId')
      .getRawMany();

    const map = new Map<string, { totalOrders: number; totalSpent: number; lastOrderAt: Date | null }>();
    for (const r of rows) {
      if (!r.clientId) continue;
      map.set(r.clientId, {
        totalOrders: Number(r.totalOrders ?? 0),
        totalSpent:  Number(r.totalSpent  ?? 0),
        lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null,
      });
    }
    return map;
  }

  /**
   * Charge un Set<clientId> des abonnés actifs de l'entreprise
   * depuis la table follows.
   */
  private async loadAbonnesIds(companyId: string): Promise<Set<string>> {
    const follows = await this.followRepo.find({
      where: {
        targetType:   TargetActorType.COMPANY,
        targetId:     companyId,
        followerType: FollowerActorType.CLIENT,
        isSubscribed: true,
        status:       FollowStatus.ACTIVE,
      },
      select: ['followerId'],  // followerId = Client profile id
    });
    return new Set(follows.map(f => f.followerId).filter(Boolean));
  }

  /* ══════════════════════════════════════════════════════════════
   * DÉTAIL D'UN CLIENT — profil complet vu par l'entreprise
   *
   * Retourne :
   *   - Identité (nom, email, avatar)
   *   - KPI (commandes, CA, dernière commande)
   *   - Segment calculé
   *   - isSuivi (abonnement à la boutique)
   *   - 10 dernières commandes passées dans cette boutique
   * ════════════════════════════════════════════════════════════ */
  async getClientDetail(userId: string, clientId: string) {
    /* Résoudre l'entreprise */
    const company = await this.companyRepo.findOne({
      where: { userId }, select: ['id', 'companyName'],
    });
    if (!company) throw new NotFoundException('Profil entreprise introuvable.');

    /* Charger le profil client */
    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      select: ['id', 'userId', 'createdAt'],
    });
    if (!client) throw new NotFoundException('Client introuvable.');

    /* Charger les données en parallèle */
    const [user, commandesRaw, isSuiviRow] = await Promise.all([
      /* Identité */
      this.userRepo.findOne({
        where:  { id: client.userId },
        select: ['id', 'firstName', 'lastName', 'email', 'profilePicture', 'phone', 'createdAt'],
      }),

      /* 10 dernières commandes dans cette boutique */
      this.commandeRepo.find({
        where:   { clientId, companyId: company.id },
        select:  ['id', 'numero', 'status', 'total', 'sousTotal', 'fraisLivraison', 'createdAt', 'dateLivraisonEffective', 'modeLivraison'],
        order:   { createdAt: 'DESC' },
        take:    10,
      }),

      /* Est-il abonné ? */
      this.followRepo.findOne({
        where: {
          targetType:   TargetActorType.COMPANY,
          targetId:     company.id,
          followerType: FollowerActorType.CLIENT,
          followerId:   clientId,
          isSubscribed: true,
          status:       FollowStatus.ACTIVE,
        },
        select: ['id'],
      }),
    ]);

    /* Calculer les agrégats */
    const validCommandes = commandesRaw.filter(c => this.VALID_STATUSES.includes(c.status));
    const totalOrders    = validCommandes.length;
    const totalSpent     = validCommandes.reduce((s, c) => s + Number(c.total ?? 0), 0);
    const lastOrderAt    = commandesRaw[0]?.createdAt ?? null;
    const isSuivi        = !!isSuiviRow;
    const segment        = calcSegment(totalOrders, totalSpent, isSuivi);

    /* Compter toutes les commandes (pas seulement les 10 dernières) */
    const allOrdersCount = await this.commandeRepo.count({
      where: { clientId, companyId: company.id },
    });

    const allOrdersTotal = allOrdersCount > 10
      ? (await this.commandeRepo
          .createQueryBuilder('c')
          .select('SUM(c.total)', 'total')
          .where('c.clientId = :clientId', { clientId })
          .andWhere('c.companyId = :companyId', { companyId: company.id })
          .andWhere('c.status IN (:...statuses)', { statuses: this.VALID_STATUSES })
          .getRawOne()
        ).total ?? 0
      : totalSpent;

    return {
      /* Identité */
      id:             clientId,
      userId:         client.userId,
      fullName:       user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Client',
      email:          user?.email          ?? '—',
      phone:          user?.phone          ?? null,
      profilePicture: user?.profilePicture ?? null,
      membreDepuis:   user?.createdAt      ?? client.createdAt,

      /* Métriques */
      totalOrders:    allOrdersCount,
      totalSpent:     Number(allOrdersTotal),
      lastOrderAt,
      segment,
      isSuivi,

      /* 10 dernières commandes */
      commandes: commandesRaw.map(c => ({
        id:           c.id,
        numero:       c.numero,
        status:       c.status,
        total:        Number(c.total ?? 0),
        sousTotal:    Number(c.sousTotal ?? 0),
        fraisLivraison: Number(c.fraisLivraison ?? 0),
        modeLivraison: c.modeLivraison,
        createdAt:    c.createdAt,
        livraisonEffective: c.dateLivraisonEffective ?? null,
      })),
    };
  }

  /** Résultat vide avec statistiques nulles */
  private emptyResult(page: number, limit: number): ClientsResult {
    return {
      data:  [],
      total: 0,
      page,
      pages: 0,
      stats: {
        total: 0, buyers: 0, abonnes: 0,
        vip: 0, fideles: 0, reguliers: 0, nouveaux: 0,
        caTotal: 0, panierMoyen: 0,
      },
    };
  }
}
