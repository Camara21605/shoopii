/* ============================================================
 * FICHIER : partenaire-dashboard.service.ts
 * SERVICE : Données réelles pour le dashboard partenaire
 * ============================================================ */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';

import {
  CreationCode,
  CodeStatus,
} from '../../../database/entities/code-creation.entity';

import {
  PaiementDistribution,
  DistributionActeurType,
  DistributionStatus,
} from '../../../database/entities/paiement/paiement-distribution.entity';

import { Wallet }  from '../../../database/entities/wallet.entity';
import { Report, ReportStatus, ReportSeverity } from '../../../database/entities/report.entity';
import { PlatformSettings } from '../../../database/entities/platform-settings.entity';
import { UserRole } from '../../../common/enums/user-role.enum';

/* Types de distribution qui correspondent aux revenus du partenaire */
const PARTNER_DIST_TYPES = [
  DistributionActeurType.PARTENAIRE,
  DistributionActeurType.PARTENAIRE_PRODUIT,
  DistributionActeurType.PARTENAIRE_LIVRAISON,
];

const ROLE_TO_TYPE: Partial<Record<UserRole, string>> = {
  [UserRole.COMPANY]:       'ent',
  [UserRole.DELIVERY]:      'lvr',
  [UserRole.CORRESPONDENT]: 'cor',
  [UserRole.CLIENT]:        'cli',
};

const TYPE_TO_ROLE: Record<string, UserRole> = {
  ent: UserRole.COMPANY,
  lvr: UserRole.DELIVERY,
  cor: UserRole.CORRESPONDENT,
  cli: UserRole.CLIENT,
};

const TYPE_TO_PREFIX: Record<string, string> = {
  ent: 'ENT', lvr: 'LVR', cor: 'COR', cli: 'CLI',
};

const GRAVITE_TO_SEVERITY: Record<string, ReportSeverity> = {
  high: ReportSeverity.CRITICAL,
  med:  ReportSeverity.WARNING,
  low:  ReportSeverity.INFO,
};

const SEVERITY_TO_GRAVITE: Record<ReportSeverity, string> = {
  [ReportSeverity.CRITICAL]: 'high',
  [ReportSeverity.WARNING]:  'med',
  [ReportSeverity.INFO]:     'low',
};

function relativeTime(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return "À l'instant";
  if (diff < 3600)  return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

@Injectable()
export class PartenaireDashboardService {

  constructor(
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Delivery)
    private readonly deliveryRepo: Repository<Delivery>,

    @InjectRepository(Correspondent)
    private readonly correspondantRepo: Repository<Correspondent>,

    @InjectRepository(CreationCode)
    private readonly codeRepo: Repository<CreationCode>,

    @InjectRepository(PaiementDistribution)
    private readonly distRepo: Repository<PaiementDistribution>,

    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,

    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(PlatformSettings)
    private readonly platformRepo: Repository<PlatformSettings>,
  ) {}

  /* ── Interne : récupère le profil partenaire ou lève 404 ── */
  private async findPartner(userId: string): Promise<Partner> {
    const partner = await this.partnerRepo.findOne({ where: { userId } });
    if (!partner) throw new NotFoundException('Profil partenaire introuvable');
    return partner;
  }

  private mapCodeStatus(status: CodeStatus): 'used' | 'sent' | 'expired' {
    if (status === CodeStatus.USED)    return 'used';
    if (status === CodeStatus.PENDING) return 'sent';
    return 'expired';
  }

  private buildChartData(entrepriseDates: Date[], livreurDates: Date[]) {
    const now    = new Date();
    const DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    const semaine = Array.from({ length: 7 }, (_, i) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 6 + i);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return {
        x: DAY_FR[from.getDay()],
        e: entrepriseDates.filter(d => d >= from && d < to).length,
        l: livreurDates.filter(d => d >= from && d < to).length,
      };
    });

    const mois = Array.from({ length: 4 }, (_, i) => {
      const from = new Date(now);
      from.setDate(from.getDate() - 28 + i * 7);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return {
        x: `S${i + 1}`,
        e: entrepriseDates.filter(d => d >= from && d < to).length,
        l: livreurDates.filter(d => d >= from && d < to).length,
      };
    });

    const annee = Array.from({ length: 4 }, (_, i) => {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 12 + i * 3);
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setMonth(to.getMonth() + 3);
      return {
        x: `T${i + 1}`,
        e: entrepriseDates.filter(d => d >= from && d < to).length,
        l: livreurDates.filter(d => d >= from && d < to).length,
      };
    });

    return { semaine, mois, annee };
  }

  /* ════════════════════════════════════════════════════════════
   * VUE D'ENSEMBLE
   * ════════════════════════════════════════════════════════════ */

  async getOverview(userId: string) {
    const partner    = await this.findPartner(userId);
    const pid        = partner.id;
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      codesTotal, codesUsed, codesPending,
      nbCompanies, nbDeliveries, nbCorrespondants,
      commMonthRow,
    ] = await Promise.all([
      this.codeRepo.count({ where: { generatedById: userId } }),
      this.codeRepo.count({ where: { generatedById: userId, status: CodeStatus.USED } }),
      this.codeRepo.count({ where: { generatedById: userId, status: CodeStatus.PENDING } }),
      this.companyRepo.count({ where: { partnerId: pid } }),
      this.deliveryRepo.count({ where: { partnerId: pid } }),
      this.correspondantRepo.count({ where: { partnerId: pid } }),
      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(pd.montant), 0)', 'total')
        .where('pd.acteurUserId = :uid', { uid: userId })
        .andWhere('pd.acteurType IN (:...types)', { types: PARTNER_DIST_TYPES })
        .andWhere('pd.status = :st', { st: DistributionStatus.RELEASED })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),
    ]);

    const [recentCodes, recentCommissions] = await Promise.all([
      this.codeRepo.find({
        where:     { generatedById: userId, status: CodeStatus.USED },
        order:     { usedAt: 'DESC' },
        take:      3,
        relations: ['usedBy'],
      }),
      this.distRepo.find({
        where: { acteurUserId: userId },
        order: { createdAt: 'DESC' },
        take:  3,
      }),
    ]);

    const [allCompanies, allDeliveries, allCorrespondants] = await Promise.all([
      this.companyRepo.find({ where: { partnerId: pid }, select: ['id', 'createdAt'] }),
      this.deliveryRepo.find({ where: { partnerId: pid }, select: ['id', 'createdAt'] }),
      this.correspondantRepo.find({ where: { partnerId: pid }, select: ['id', 'createdAt'] }),
    ]);

    const chart = this.buildChartData(
      allCompanies.map(c => c.createdAt),
      [...allDeliveries, ...allCorrespondants].map(c => c.createdAt),
    );

    const activiteRecente = [
      ...recentCodes.map(c => ({
        icone: 'fa-circle-check',
        kind:  'ok',
        texte: `<b>${c.usedBy ? `${c.usedBy.firstName} ${c.usedBy.lastName}` : 'Un utilisateur'}</b> a créé son compte avec votre code`,
        _date: c.usedAt ?? c.createdAt,
      })),
      ...recentCommissions.map(d => ({
        icone: 'fa-coins',
        kind:  'cash',
        texte: `Commission de <b>${Number(d.montant).toLocaleString('fr-FR')} GNF</b> créditée`,
        _date: d.createdAt,
      })),
    ]
      .sort((a, b) => b._date.getTime() - a._date.getTime())
      .slice(0, 5)
      .map(({ _date, ...rest }) => ({ ...rest, when: relativeTime(_date) }));

    const tauxConversion = codesTotal > 0
      ? Math.round((codesUsed / codesTotal) * 1000) / 10
      : 0;

    return {
      partenaire: { name: partner.name, zone: partner.zone, status: partner.status },
      kpis: {
        totalActeurs:     nbCompanies + nbDeliveries + nbCorrespondants,
        codesActifs:      codesPending,
        tauxConversion,
        commissionsMonth: +commMonthRow?.total || 0,
      },
      reseau: { entreprises: nbCompanies, livreurs: nbDeliveries, correspondants: nbCorrespondants },
      chart,
      activiteRecente,
    };
  }

  /* ════════════════════════════════════════════════════════════
   * CODES
   * ════════════════════════════════════════════════════════════ */

  async getCodes(userId: string) {
    const codes = await this.codeRepo.find({
      where:     { generatedById: userId },
      order:     { createdAt: 'DESC' },
      relations: ['usedBy'],
      take:      100,
    });

    return {
      stats: {
        total:   codes.length,
        used:    codes.filter(c => c.status === CodeStatus.USED).length,
        pending: codes.filter(c => c.status === CodeStatus.PENDING).length,
        expired: codes.filter(c => c.status !== CodeStatus.USED && c.status !== CodeStatus.PENDING).length,
      },
      codes: codes.map(c => ({
        id:           c.id,
        code:         c.code,
        type:         ROLE_TO_TYPE[c.targetRole] ?? 'ent',
        destinataire: c.targetEmail ?? null,
        statut:       this.mapCodeStatus(c.status),
        creeLe:       c.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        utilisePar:   c.usedBy ? `${c.usedBy.firstName} ${c.usedBy.lastName}` : null,
        usedAt:       c.usedAt?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) ?? null,
      })),
    };
  }

  async generateCode(userId: string, dto: { type: string; targetEmail?: string }) {
    const partner    = await this.findPartner(userId);
    const targetRole = TYPE_TO_ROLE[dto.type] ?? UserRole.COMPANY;
    const prefix     = TYPE_TO_PREFIX[dto.type] ?? 'ENT';

    /* Format : {PREFIX}-{5chars} = 9 chars max, compatible varchar(12) */
    const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const suffix = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code   = `${prefix}-${suffix}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const entity = this.codeRepo.create({
      code,
      targetRole,
      targetEmail:   dto.targetEmail ?? null,
      validityDays:  7,
      expiresAt,
      maxUses:       1,
      generatedById: userId,
      partnerId:     partner.id,
      status:        CodeStatus.PENDING,
    });

    await this.codeRepo.save(entity);
    return { code, expiresAt };
  }

  /* ════════════════════════════════════════════════════════════
   * ACTEURS
   * ════════════════════════════════════════════════════════════ */

  async getActeurs(userId: string) {
    const partner = await this.findPartner(userId);
    const pid     = partner.id;

    const initials = (name: string) =>
      name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();

    const [companies, deliveries, correspondants] = await Promise.all([
      this.companyRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
      this.deliveryRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
      this.correspondantRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
    ]);

    const acteurs = [
      ...companies.map(c => ({
        id:        c.id,
        type:      'ent' as const,
        nom:       c.companyName,
        meta:      'Entreprise',
        avatar:    initials(c.companyName),
        statut:    c.status === 'active' ? 'act' : 'pend',
        userId:    c.userId,
        createdAt: c.createdAt.toISOString(),
      })),
      ...deliveries.map(d => ({
        id:        d.id,
        type:      'lvr' as const,
        nom:       d.fullName,
        meta:      `Livreur${d.ville ? ' · ' + d.ville : ''}`,
        avatar:    initials(d.fullName),
        statut:    d.status === 'active' ? 'act' : 'pend',
        userId:    d.userId,
        createdAt: d.createdAt.toISOString(),
      })),
      ...correspondants.map(c => ({
        id:        c.id,
        type:      'cor' as const,
        nom:       c.fullName,
        meta:      c.depotVille ? `Correspondant · ${c.depotVille}` : 'Correspondant',
        avatar:    initials(c.fullName),
        statut:    c.status === 'active' ? 'act' : 'pend',
        userId:    c.userId,
        createdAt: c.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      total:            acteurs.length,
      nbCompanies:      companies.length,
      nbDeliveries:     deliveries.length,
      nbCorrespondants: correspondants.length,
      acteurs,
    };
  }

  /* ════════════════════════════════════════════════════════════
   * COMMISSIONS
   * ════════════════════════════════════════════════════════════ */

  async getCommissions(userId: string) {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [wallet, totalRow, monthRow, history, platform] = await Promise.all([
      this.walletRepo.findOne({ where: { userId } }),
      this.distRepo
        .createQueryBuilder('pd')
        .select(`COALESCE(SUM(CASE WHEN pd.status = '${DistributionStatus.RELEASED}' THEN pd.montant ELSE 0 END), 0)`, 'total')
        .where('pd.acteurUserId = :uid', { uid: userId })
        .andWhere('pd.acteurType IN (:...types)', { types: PARTNER_DIST_TYPES })
        .getRawOne(),
      this.distRepo
        .createQueryBuilder('pd')
        .select(`COALESCE(SUM(CASE WHEN pd.status = '${DistributionStatus.RELEASED}' THEN pd.montant ELSE 0 END), 0)`, 'total')
        .where('pd.acteurUserId = :uid', { uid: userId })
        .andWhere('pd.acteurType IN (:...types)', { types: PARTNER_DIST_TYPES })
        .andWhere('pd.createdAt >= :from', { from: monthStart })
        .getRawOne(),
      this.distRepo.find({
        where: { acteurUserId: userId },
        order: { createdAt: 'DESC' },
        take:  30,
      }),
      this.platformRepo.findOne({ where: { id: 1 } }),
    ]);

    return {
      balance:               +(wallet?.balance ?? 0),
      totalGagne:            +totalRow?.total || 0,
      commissionsMonth:      +monthRow?.total  || 0,
      /* Taux réels depuis PlatformSettings — mis à jour par le super admin */
      tauxVentes:     +(platform?.ratioPartenaireProduit   ?? 20),
      tauxLivraisons: +(platform?.ratioPartenaireLivraison ?? 25),
      historique: history.map(d => ({
        source:  d.acteurNom,
        type:    d.acteurType?.includes('livraison') ? 'lvr' : 'ent',
        detail:  `Commission ${d.acteurType?.replace(/_/g, ' ') ?? ''}`,
        date:    d.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        montant: +d.montant,
        statut:  d.status,
      })),
    };
  }

  /* ════════════════════════════════════════════════════════════
   * SIGNALEMENTS
   * ════════════════════════════════════════════════════════════ */

  async getSignalements(userId: string) {
    const reports = await this.reportRepo.find({
      where: { reporterId: userId },
      order: { createdAt: 'DESC' },
    });

    const signalements = reports.map(r => {
      let meta: Record<string, string> = {};
      try { meta = JSON.parse(r.description ?? '{}'); } catch { /**/ }
      return {
        id:         `RPT-${r.id.slice(0, 8).toUpperCase()}`,
        cible:      meta.cible ?? r.title ?? 'Inconnu',
        type:       meta.type ?? 'ent',
        motif:      meta.motif ?? 'autre',
        motifLabel: meta.motifLabel ?? r.title ?? '',
        gravite:    SEVERITY_TO_GRAVITE[r.severity] ?? 'med',
        raison:     meta.raison ?? '',
        statut:     r.status === ReportStatus.RESOLVED ? 'resolved' : 'review',
        date:       r.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      };
    });

    return {
      stats: {
        total:   reports.length,
        enCours: reports.filter(r => r.status === ReportStatus.PENDING).length,
        traites: reports.filter(r => r.status === ReportStatus.RESOLVED).length,
        rejetes: 0,
      },
      signalements,
    };
  }

  async submitSignalement(userId: string, dto: {
    cible: string;
    type: string;
    motif: string;
    motifLabel: string;
    gravite: string;
    raison: string;
  }) {
    const raison = dto.raison.slice(0, 200);
    const meta   = JSON.stringify({ cible: dto.cible.slice(0, 80), type: dto.type, motif: dto.motif, motifLabel: dto.motifLabel, raison }).slice(0, 498);
    const report = this.reportRepo.create({
      title:       `${dto.cible} — ${dto.motifLabel}`.slice(0, 254),
      description: meta,
      severity:    GRAVITE_TO_SEVERITY[dto.gravite] ?? ReportSeverity.WARNING,
      reporterId:  userId,
    });
    const saved = await this.reportRepo.save(report);
    return { ref: `RPT-${saved.id.slice(0, 8).toUpperCase()}` };
  }
}
