/* ============================================================
 * FICHIER : partenaire-dashboard.service.ts
 * SERVICE : Données réelles pour le dashboard partenaire
 * ============================================================ */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Partner }       from '../../../database/entities/profiles/partenaire-profile.entity';
import { Company }       from '../../../database/entities/profiles/entreprise-profile.entity';
import { Delivery }      from '../../../database/entities/profiles/livreur-profile.entity';
import { Correspondent } from '../../../database/entities/profiles/correspondant-profile.entity';
import { Commande }      from '../../../database/entities/commande/commande.entity';
import { User }          from '../../../database/entities/user.entity';
import { PartnerSetting } from '../../partner-settings/partner-settings.entity';
import { CommissionCalculatorService } from '../../commission/services/commission-calculator.service';

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

/* Reflet exact de TYPE_LABEL dans usePartenaireState.ts (frontend) — même
 * mapping utilisé pour composer le texte, nécessaire ici pour le décomposer. */
const TYPE_LABEL_REVERSE: Record<string, string> = {
  Entreprise:    'ent',
  Livreur:       'lvr',
  Correspondant: 'cor',
  Partenaire:    'par',
};

/**
 * BUG CORRIGÉ — getSignalements() ci-dessous tentait de JSON.parse(r.description)
 * en supposant le format écrit par le POST /dashboard/partenaire/signalements
 * (submitSignalement, plus bas) : `{"cible":...,"type":...,"motif":...}`.
 * Mais le frontend n'appelle JAMAIS cet endpoint dédié — il passe par le
 * POST /reports partagé (voir ReportsService.create), qui écrit un texte
 * LISIBLE, pas du JSON : `[${motifLabel} · ${TYPE_LABEL[type]}] ${raison}`
 * (voir usePartenaireState.ts, envoyerSignalement). JSON.parse() échouait
 * donc systématiquement, silencieusement absorbé par le catch{}, et TOUS
 * les signalements affichaient motifLabel/type par défaut avec la vraie
 * raison saisie par le partenaire purement et simplement PERDUE à
 * l'affichage (bien que réellement stockée en base).
 *
 * Reste volontairement compatible avec l'ANCIEN format JSON (si jamais
 * des lignes existent déjà en base depuis submitSignalement) en tentant
 * JSON.parse() d'abord, avant de retomber sur ce parseur texte.
 */
function parseDescription(description: string | null, fallbackTitle: string): {
  cible: string; type: string; motifLabel: string; raison: string;
} {
  if (description) {
    try {
      const meta = JSON.parse(description);
      if (meta && typeof meta === 'object') {
        return {
          cible:      meta.cible      ?? fallbackTitle,
          type:       meta.type       ?? 'ent',
          motifLabel: meta.motifLabel ?? fallbackTitle,
          raison:     meta.raison     ?? '',
        };
      }
    } catch { /* pas du JSON — format texte réel, voir ci-dessous */ }

    const match = /^\[(.+?)\s·\s(.+?)\]\s?([\s\S]*)$/.exec(description);
    if (match) {
      return {
        cible:      fallbackTitle,
        type:       TYPE_LABEL_REVERSE[match[2]] ?? 'ent',
        motifLabel: match[1],
        raison:     match[3] ?? '',
      };
    }
  }
  return { cible: fallbackTitle, type: 'ent', motifLabel: fallbackTitle, raison: description ?? '' };
}

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

    @InjectRepository(Commande)
    private readonly commandeRepo: Repository<Commande>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(PartnerSetting)
    private readonly partnerSettingRepo: Repository<PartnerSetting>,

    private readonly commissionCalculator: CommissionCalculatorService,
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

    /* SÉCURITÉ — `texte` était du HTML brut avec le prénom/nom de l'utilisateur
     * inscrit (`c.usedBy.firstName/lastName`, librement choisis à l'inscription)
     * interpolé sans échappement, rendu ensuite via dangerouslySetInnerHTML côté
     * frontend (OverviewPage.tsx) : XSS stockée — n'importe qui s'inscrivant via
     * un code de ce partenaire avec un nom du type "<img src=x onerror=...>"
     * exécutait du JS dans la session du partenaire consultant son tableau de
     * bord. `texte` est maintenant du texte brut ; `highlight` isole la partie
     * à mettre en gras, rendue en JSX (auto-échappé) côté frontend. */
    const activiteRecente = [
      ...recentCodes.map(c => {
        const nom = c.usedBy ? `${c.usedBy.firstName} ${c.usedBy.lastName}` : 'Un utilisateur';
        return {
          icone: 'fa-circle-check',
          kind:  'ok',
          texte: `${nom} a créé son compte avec votre code`,
          highlight: nom,
          _date: c.usedAt ?? c.createdAt,
        };
      }),
      ...recentCommissions.map(d => {
        const montant = `${Number(d.montant).toLocaleString('fr-FR')} GNF`;
        return {
          icone: 'fa-coins',
          kind:  'cash',
          texte: `Commission de ${montant} créditée`,
          highlight: montant,
          _date: d.createdAt,
        };
      }),
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
    /* BUG CORRIGÉ — les stats étaient dérivées du tableau `codes`, lui-même
     * plafonné à 100 lignes (take: 100) : un partenaire ayant généré plus
     * de 100 codes au fil du temps aurait vu des compteurs faux (ex.
     * "Codes générés : 100" au lieu du vrai total). Comptés séparément ici
     * via des requêtes COUNT, indépendantes de la pagination de la liste. */
    const [codes, total, used, pending] = await Promise.all([
      this.codeRepo.find({
        where:     { generatedById: userId },
        order:     { createdAt: 'DESC' },
        relations: ['usedBy'],
        take:      100,
      }),
      this.codeRepo.count({ where: { generatedById: userId } }),
      this.codeRepo.count({ where: { generatedById: userId, status: CodeStatus.USED } }),
      this.codeRepo.count({ where: { generatedById: userId, status: CodeStatus.PENDING } }),
    ]);

    return {
      stats: {
        total,
        used,
        pending,
        expired: total - used - pending,
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

    /* BUG CORRIGÉ — nbCompanies/nbDeliveries/nbCorrespondants (chips de
     * filtre "Entreprises/Livreurs/Correspondants") étaient dérivés de
     * companies.length/deliveries.length/correspondants.length, eux-mêmes
     * plafonnés à 50 (take: 50) : un partenaire ayant recruté plus de 50
     * entreprises (ou livreurs, ou correspondants) aurait vu un compteur
     * bloqué à 50 au lieu du vrai total. Comptés séparément ici via COUNT,
     * indépendamment de la liste affichée (elle reste plafonnée à 50 par
     * catégorie — cette page n'a pas de pagination). */
    const [companies, deliveries, correspondants, nbCompanies, nbDeliveries, nbCorrespondants] = await Promise.all([
      this.companyRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
      this.deliveryRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
      this.correspondantRepo.find({ where: { partnerId: pid }, order: { createdAt: 'DESC' }, take: 50 }),
      this.companyRepo.count({ where: { partnerId: pid } }),
      this.deliveryRepo.count({ where: { partnerId: pid } }),
      this.correspondantRepo.count({ where: { partnerId: pid } }),
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
      total:            nbCompanies + nbDeliveries + nbCorrespondants,
      nbCompanies,
      nbDeliveries,
      nbCorrespondants,
      acteurs,
    };
  }

  /* ════════════════════════════════════════════════════════════
   * FICHE DÉTAIL D'UN ACTEUR — bouton "Gérer" (ActeursPage.tsx)
   *
   * Terminé — remplace le faux toast "Profil de {nom}" par une vraie
   * fiche : coordonnées réelles de l'acteur + commande/commission
   * réellement générées POUR CE PARTENAIRE par cet acteur précis
   * (jointure PaiementDistribution ↔ Commande sur companyId/livreurId/
   * correspondantId, filtrée sur les parts PARTENAIRE_* de ce partenaire).
   *
   * Sécurité : `where: { id: actorId, partnerId: pid }` — un partenaire ne
   * peut ouvrir que la fiche d'un acteur qu'IL a lui-même recruté (même
   * garde que getActeurs()) ; NotFoundException sinon, jamais un 403 qui
   * confirmerait l'existence de l'ID chez un autre partenaire.
   * ════════════════════════════════════════════════════════════ */

  async getActeurDetail(userId: string, type: string, actorId: string) {
    const partner = await this.findPartner(userId);
    const pid     = partner.id;

    const initials = (name: string) =>
      name.trim().split(/\s+/).map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();

    let nom: string;
    let statut: 'act' | 'pend';
    let entityUserId: string;
    let commandeColumn: 'companyId' | 'livreurId' | 'correspondantId';
    let contact: { telephone: string | null; email: string | null; ville: string | null; adresse: string | null; photoUrl: string | null };
    let memberSince: Date;

    if (type === 'ent') {
      const c = await this.companyRepo.findOne({ where: { id: actorId, partnerId: pid } });
      if (!c) throw new NotFoundException('Entreprise introuvable.');
      nom = c.companyName;
      statut = c.status === 'active' ? 'act' : 'pend';
      entityUserId = c.userId;
      commandeColumn = 'companyId';
      memberSince = c.createdAt;
      contact = { telephone: c.businessPhone, email: c.businessEmail, ville: c.ville, adresse: c.adresse, photoUrl: c.logo };
    } else if (type === 'lvr') {
      const d = await this.deliveryRepo.findOne({ where: { id: actorId, partnerId: pid } });
      if (!d) throw new NotFoundException('Livreur introuvable.');
      nom = d.fullName;
      statut = d.status === 'active' ? 'act' : 'pend';
      entityUserId = d.userId;
      commandeColumn = 'livreurId';
      memberSince = d.createdAt;
      contact = { telephone: d.phone, email: d.email, ville: d.ville, adresse: null, photoUrl: d.photoUrl };
    } else if (type === 'cor') {
      const c = await this.correspondantRepo.findOne({ where: { id: actorId, partnerId: pid } });
      if (!c) throw new NotFoundException('Correspondant introuvable.');
      nom = c.fullName;
      statut = c.status === 'active' ? 'act' : 'pend';
      entityUserId = c.userId;
      commandeColumn = 'correspondantId';
      memberSince = c.createdAt;
      /* phone/email vivent sur User pour les correspondants (jamais dupliqués
       * sur Correspondent — voir le commentaire "NE PAS ajouter" sur l'entité). */
      const user = await this.userRepo.findOne({ where: { id: entityUserId }, select: ['phone', 'email'] });
      contact = { telephone: user?.phone ?? null, email: user?.email ?? null, ville: c.depotVille, adresse: c.depotAdresse, photoUrl: null };
    } else {
      throw new BadRequestException(`type doit être 'ent', 'lvr' ou 'cor' (reçu: "${type}").`);
    }

    const [nbCommandes, commissionRow] = await Promise.all([
      this.commandeRepo.count({ where: { [commandeColumn]: actorId } as any }),
      this.distRepo
        .createQueryBuilder('pd')
        .select('COALESCE(SUM(CAST(pd.montant AS DECIMAL)), 0)', 'total')
        .innerJoin(Commande, 'c', 'c.id = pd.commandeId')
        .where('pd.acteurUserId = :puid', { puid: userId })
        .andWhere('pd.acteurType IN (:...types)', {
          types: [DistributionActeurType.PARTENAIRE_PRODUIT, DistributionActeurType.PARTENAIRE_LIVRAISON],
        })
        .andWhere('pd.status = :st', { st: DistributionStatus.RELEASED })
        .andWhere(`c.${commandeColumn} = :aid`, { aid: actorId })
        .getRawOne<{ total: string }>(),
    ]);

    return {
      id: actorId,
      /* userId (pas actorId) — c'est l'identifiant attendu par POST /reports
       * (targetUserId), voir ActeurDetailModal.tsx::onReport(). actorId est
       * l'id de la fiche métier (Company/Delivery/Correspondent), userId
       * celui du compte User associé : deux tables différentes. */
      userId: entityUserId,
      type,
      nom,
      statut,
      avatar: initials(nom),
      memberSince: memberSince.toISOString(),
      ...contact,
      nbCommandes,
      commissionGeneree: +(commissionRow?.total ?? 0),
    };
  }

  /* ════════════════════════════════════════════════════════════
   * COMMISSIONS
   * ════════════════════════════════════════════════════════════ */

  async getCommissions(userId: string) {
    const partner    = await this.findPartner(userId);
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [wallet, totalRow, monthRow, history, platform, partnerSettings, nbCompanies] = await Promise.all([
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
      /* BUG CORRIGÉ — ni filtrée sur acteurType (PARTNER_DIST_TYPES, comme
       * les 2 sommes ci-dessus), ni sur status = RELEASED : une distribution
       * encore en escrow (pas encore réellement acquise) ou annulée/
       * remboursée (jamais réellement versée) apparaissait dans "Commissions
       * récentes" avec un "+" comme si elle était acquise — le frontend
       * n'affiche aucun statut, donc rien ne distinguait visuellement une
       * fausse entrée d'une vraie. */
      this.distRepo.find({
        where: {
          acteurUserId: userId,
          acteurType:   In(PARTNER_DIST_TYPES),
          status:       DistributionStatus.RELEASED,
        },
        order: { createdAt: 'DESC' },
        take:  30,
      }),
      this.platformRepo.findOne({ where: { id: 1 } }),
      this.partnerSettingRepo.findOne({ where: { id: 1 } }),
      this.companyRepo.count({ where: { partnerId: partner.id } }),
    ]);

    /* BUG CORRIGÉ — tauxVentes affichait TOUJOURS PlatformSettings
     * .ratioPartenaireProduit (le taux par défaut de la plateforme), même
     * quand le Centre de Gestion des Partenaires configure un taux fixe ou
     * un système de paliers par volume de recrutement (PartnerSetting
     * .commissionMode) — le taux RÉELLEMENT appliqué par le CommissionEngine
     * à la prochaine vente de ce partenaire pouvait donc être totalement
     * différent de celui affiché ici. Résolu maintenant via la MÊME méthode
     * que le moteur (CommissionCalculatorService.resoudreTauxPartenaireProduit),
     * avec le vrai nombre d'entreprises recrutées par CE partenaire.
     * tauxLivraisons reste PlatformSettings.ratioPartenaireLivraison : ce
     * taux-là n'a, lui, aucun système de palier côté moteur (voir
     * CommissionCalculatorService.calculer() — partPartenaireLivraison
     * utilise toujours rule.ratioPartenaireLivraison telle quelle). */
    const ratioPartenaireDefaut = +(platform?.ratioPartenaireProduit ?? 20);
    const ratioShopiProduit     = +(platform?.ratioShopiProduit ?? 70);
    const tauxVentes = this.commissionCalculator.resoudreTauxPartenaireProduit(
      ratioPartenaireDefaut, ratioShopiProduit, nbCompanies, partnerSettings ?? null,
    );

    return {
      balance:               +(wallet?.balance ?? 0),
      totalGagne:            +totalRow?.total || 0,
      commissionsMonth:      +monthRow?.total  || 0,
      tauxVentes,
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
      const meta = parseDescription(r.description, r.title ?? 'Inconnu');
      return {
        id:         `RPT-${r.id.slice(0, 8).toUpperCase()}`,
        cible:      meta.cible,
        type:       meta.type,
        motif:      'autre', // id brut non récupérable depuis le texte — jamais affiché (voir motifLabel)
        motifLabel: meta.motifLabel,
        gravite:    SEVERITY_TO_GRAVITE[r.severity] ?? 'med',
        raison:     meta.raison,
        /* BUG CORRIGÉ — ne distinguait jamais INVESTIGATING de PENDING (les
         * deux retombaient sur 'review'), alors que le frontend a un statut
         * "Enquête en cours" ('invest') dédié pour ça — jamais atteignable.
         * REJECTED ajouté suite à l'introduction du vrai statut de rejet
         * (voir AdminSignalementsService.rejectSignalement). */
        statut:     r.status === ReportStatus.RESOLVED     ? 'resolved'
                  : r.status === ReportStatus.REJECTED      ? 'rejected'
                  : r.status === ReportStatus.INVESTIGATING ? 'invest'
                  : 'review',
        date:       r.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
      };
    });

    return {
      stats: {
        total:   reports.length,
        /* BUG CORRIGÉ — ne comptait que PENDING, ignorait INVESTIGATING
         * ("Enquête en cours" côté admin) alors que les deux sont "en
         * cours d'examen" du point de vue du partenaire qui a signalé. */
        enCours: reports.filter(r => r.status === ReportStatus.PENDING || r.status === ReportStatus.INVESTIGATING).length,
        traites: reports.filter(r => r.status === ReportStatus.RESOLVED).length,
        /* BUG CORRIGÉ — restait à 0 en dur : ReportStatus n'avait aucun
         * statut REJECTED, un signalement ne pouvait jamais être
         * explicitement rejeté. Voir AdminSignalementsService.rejectSignalement. */
        rejetes: reports.filter(r => r.status === ReportStatus.REJECTED).length,
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
