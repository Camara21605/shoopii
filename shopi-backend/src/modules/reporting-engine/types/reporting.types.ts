/* ============================================================
 * FICHIER      : src/modules/reporting-engine/types/reporting.types.ts
 * MODULE       : ReportingEngine
 * ROLE         : Types, DTOs, enums et interfaces du moteur de reporting
 * RESPONSABILITES :
 *   - Définit l'ensemble des types de données pour les rapports financiers
 *   - DTOs de filtres avec pagination et restriction par rôle
 *   - Structures de KPIs par section (paiements, commissions, wallets, etc.)
 *   - Types pour les graphiques et séries temporelles
 *   - Types pour les alertes financières configurables
 *   - Erreurs typées du moteur de reporting
 * DEPENDANCES  : Aucune dépendance interne (types purs)
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

/* ============================================================
 * ENUMS — PÉRIODES ET TYPES DE RAPPORT
 * ============================================================ */

export enum ReportPeriod {
  DAILY   = 'daily',
  WEEKLY  = 'weekly',
  MONTHLY = 'monthly',
  ANNUAL  = 'annual',
  CUSTOM  = 'custom',
}

export enum ReportSection {
  OVERVIEW      = 'overview',
  PAIEMENTS     = 'paiements',
  COMMISSIONS   = 'commissions',
  WALLETS       = 'wallets',
  RETRAITS      = 'retraits',
  LITIGES       = 'litiges',
  DISTRIBUTIONS = 'distributions',
}

export enum ExportFormat {
  CSV   = 'csv',
  PDF   = 'pdf',
  EXCEL = 'excel',
}

export type TimeGranularity = 'day' | 'week' | 'month';

/* ============================================================
 * ENUMS — ALERTES FINANCIÈRES
 * ============================================================ */

export enum AlertType {
  REFUND_SPIKE          = 'refund_spike',
  DISPUTE_SPIKE         = 'dispute_spike',
  SALES_DROP            = 'sales_drop',
  NEGATIVE_WALLET       = 'negative_wallet',
  PAYMENT_VOLUME_SPIKE  = 'payment_volume_spike',
  PROVIDER_FAILURE      = 'provider_failure',
  WALLET_FREEZE_SPIKE   = 'wallet_freeze_spike',
  WITHDRAWAL_STUCK      = 'withdrawal_stuck',
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH     = 'high',
  NORMAL   = 'normal',
}

/* ============================================================
 * ENUMS — RÔLES ET FILTRES D'ACCÈS
 * ============================================================ */

export enum RoleFilter {
  SUPER_ADMIN   = 'super_admin',
  ADMIN         = 'admin',
  PARTNER       = 'partner',
  ENTREPRISE    = 'entreprise',
  LIVREUR       = 'livreur',
  CORRESPONDANT = 'correspondant',
}

/* ============================================================
 * ERREURS TYPÉES
 * ============================================================ */

export enum ReportErreurType {
  INVALID_FILTER       = 'INVALID_FILTER',
  INVALID_PERIOD       = 'INVALID_PERIOD',
  UNAUTHORIZED         = 'UNAUTHORIZED',
  NOT_FOUND            = 'NOT_FOUND',
  EXPORT_ERROR         = 'EXPORT_ERROR',
  INTERNAL_ERROR       = 'INTERNAL_ERROR',
}

export class ReportErreur extends Error {
  constructor(
    public readonly type: ReportErreurType,
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ReportErreur';
  }
}

/* ============================================================
 * FILTRE PRINCIPAL
 * ============================================================ */

export interface ReportFilter {
  dateFrom:  Date;
  dateTo:    Date;
  period?:   ReportPeriod;

  requestingUserId?:   string;
  requestingUserRole?: RoleFilter;

  userId?:          string;
  partenaireId?:    string;
  adminId?:         string;
  livreurId?:       string;
  correspondantId?: string;
  clientUserId?:    string;

  pays?:      string;
  ville?:     string;
  commune?:   string;
  quartier?:  string;

  methodePaiement?: string[];
  devise?:          string;

  page?:    number;
  limit?:   number;

  includeTimeSeries?: boolean;
  includeBreakdown?:  boolean;
  granularity?:       TimeGranularity;
}

/* ============================================================
 * STRUCTURES DE KPIS
 * ============================================================ */

export interface PaiementKpi {
  total:             number;
  montantTotal:      number;
  montantConfirme:   number;
  montantRembourse:  number;
  nbConfirmes:       number;
  nbEchoues:         number;
  nbExpires:         number;
  tauxReussite:      number;
  panierMoyen:       number;
  parProvider:       Record<string, { nb: number; montant: number }>;
  parMethode:        Record<string, { nb: number; montant: number }>;
}

export interface CommissionKpi {
  shopiProduit:          number;
  shopiLivraison:        number;
  shopiTotal:            number;
  partenairesProduit:    number;
  partenairesLivraison:  number;
  partenairesTotal:      number;
  adminsProduit:         number;
  adminsLivraison:       number;
  adminsTotal:           number;
  livreurs:              number;
  correspondants:        number;
  entreprises:           number;
  totalDistribue:        number;
  enEscrow:              number;
}

export interface WalletKpi {
  totalWallets:          number;
  walletsActifs:         number;
  walletsFrozen:         number;
  walletsFermes:         number;
  balanceTotale:         number;
  pendingBalanceTotale:  number;
  blockedBalanceTotale:  number;
  totalCredite:          number;
  totalDebite:           number;
  parType:               Record<string, { nb: number; balance: number }>;
}

export interface RetraitKpi {
  total:             number;
  montantTotal:      number;
  montantCompleted:  number;
  montantFailed:     number;
  montantPending:    number;
  fraisTotal:        number;
  nbCompleted:       number;
  nbFailed:          number;
  tauxReussite:      number;
  parMethode:        Record<string, { nb: number; montant: number }>;
}

export interface DisputeKpi {
  total:                     number;
  ouverts:                   number;
  enInstruction:             number;
  resolus:                   number;
  fermes:                    number;
  tauxLitiges:               number;
  montantContesteTotale:     number;
  montantRembourseTotal:     number;
  tauxRemboursement:         number;
  parMotif:                  Record<string, number>;
  parDecision:               Record<string, number>;
  delaiMoyenResolutionHeures: number;
}

export interface DistributionKpi {
  total:            number;
  montantTotal:     number;
  montantReleased:  number;
  montantEscrow:    number;
  montantCancelled: number;
  montantRefunded:  number;
  parActeurType:    Record<string, { nb: number; montant: number }>;
}

export interface OverviewKpi {
  periode:             { from: Date; to: Date };
  paiements:           PaiementKpi;
  commissions:         CommissionKpi;
  wallets:             WalletKpi;
  retraits:            RetraitKpi;
  litiges:             DisputeKpi;
  distributions:       DistributionKpi;
  chiffreAffairesBrut: number;
  chiffreAffairesNet:  number;
  revenusShopi:        number;
  croissance:          number | null;
}

/* ============================================================
 * SÉRIES TEMPORELLES ET GRAPHIQUES
 * ============================================================ */

export interface TimeSeriesPoint {
  date:   string;
  value:  number;
  count?: number;
  label?: string;
}

export interface TimeSeriesData {
  section:     ReportSection;
  metric:      string;
  granularity: TimeGranularity;
  points:      TimeSeriesPoint[];
  total:       number;
}

export interface ChartDataset {
  label:  string;
  data:   number[];
  color?: string;
}

export interface ChartData {
  labels:   string[];
  datasets: ChartDataset[];
  total?:   number;
}

/* ============================================================
 * STRUCTURE DE RAPPORT
 * ============================================================ */

export type ReportRow = Record<string, string | number | boolean | Date | null>;

export interface FinancialReport {
  id:          string;
  type:        ReportPeriod;
  section:     ReportSection;
  filter:      Partial<ReportFilter>;
  generatedAt: Date;
  periode:     { from: Date; to: Date };
  kpis:        Partial<OverviewKpi>;
  timeSeries?: TimeSeriesData[];
  rows:        ReportRow[];
  total:       number;
  page:        number;
  pageSize:    number;
}

/* ============================================================
 * TABLEAUX DE BORD PAR RÔLE
 * ============================================================ */

export interface SuperAdminDashboard {
  filter:              Partial<ReportFilter>;
  kpis:                OverviewKpi;
  revenueTrend:        TimeSeriesData;
  paiementBreakdown:   ChartData;
  disputeTrend:        TimeSeriesData;
  withdrawalTrend:     TimeSeriesData;
  commissionBreakdown: ChartData;
  topEntreprises:      Array<{ userId: string; nom: string; montant: number; nbCommandes: number }>;
  topLivreurs:         Array<{ userId: string; nom: string; montant: number; nbCommandes: number }>;
  alerts:              FinancialAlert[];
  generatedAt:         Date;
}

export interface RoleDashboard {
  role:         RoleFilter;
  userId:       string;
  kpis:         Partial<OverviewKpi>;
  trend:        TimeSeriesData;
  details:      ReportRow[];
  totalDetails: number;
  alerts:       FinancialAlert[];
  generatedAt:  Date;
}

/* ============================================================
 * ALERTES FINANCIÈRES
 * ============================================================ */

export interface FinancialAlert {
  id:           string;
  type:         AlertType;
  severity:     AlertSeverity;
  message:      string;
  metadata:     Record<string, unknown>;
  triggeredAt:  Date;
  acknowledged: boolean;
}

/**
 * Résultat agrégé d'une passe de vérification de toutes les alertes.
 */
export interface AlertCheckResult {
  checked:   number;
  triggered: number;
  alerts:    FinancialAlert[];
}

/* ============================================================
 * PAGINATION
 * ============================================================ */

export interface PaginatedResult<T> {
  items:      T[];
  total:      number;
  page:       number;
  limit:      number;
  pages:      number;
}

/* ============================================================
 * RÉSULTATS DES EXPORTS
 * ============================================================ */

export interface ExportResult {
  format:      ExportFormat;
  filename:    string;
  content:     Buffer | string;
  size:        number;
  rows:        number;
  truncated:   boolean;
  generatedAt: Date;
}

/* ============================================================
 * FILTRES DE RAPPORT D'AUDIT
 * ============================================================ */

export interface AuditReportFilter {
  dateFrom:      Date;
  dateTo:        Date;
  eventTypes?:   string[];
  severities?:   string[];
  actorUserId?:  string;
  actorRole?:    string;
  commandeId?:   string;
  walletId?:     string;
  page?:         number;
  limit?:        number;
}

/* ============================================================
 * STATISTIQUES AVANCÉES
 * ============================================================ */

export interface ProviderStats {
  provider:        string;
  totalSessions:   number;
  confirmed:       number;
  failed:          number;
  expired:         number;
  tauxReussite:    number;
  montantTotal:    number;
  montantConfirme: number;
}

export interface ActeurStats {
  userId:          string;
  nom:             string;
  role:            string;
  nbCommandes:     number;
  montantTotal:    number;
  commissions:     number;
  nbRetraits:      number;
  balanceActuelle: number;
}

export interface GrowthAnalysis {
  currentPeriod:  { from: Date; to: Date; value: number };
  previousPeriod: { from: Date; to: Date; value: number };
  growthRate:     number | null;
  isPositive:     boolean;
  delta:          number;
}
