/* ============================================================
 * FICHIER      : src/modules/reporting-engine/reporting.engine.spec.ts
 * MODULE       : ReportingEngine — Tests unitaires
 * ROLE         : Couverture des services KPI, dashboards, analytics, exports et alertes
 * DEPENDANCES  :
 *   Jest, @nestjs/testing, TypeORM mocks manuels
 * AUTEUR       : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';

import { PaiementSession }      from '../../database/entities/paiement/paiement-session.entity';
import { PaiementDistribution } from '../../database/entities/paiement/paiement-distribution.entity';
import { Wallet }               from '../../database/entities/wallet.entity';
import { WalletTransaction }    from '../../database/entities/wallet-transaction.entity';
import { Retrait }              from '../../database/entities/paiement/retrait.entity';
import { Dispute }              from '../../database/entities/paiement/dispute.entity';
import { FinancialAuditLog }    from '../../database/entities/paiement/financial-audit-log.entity';

import { KpiEngineService }       from './services/kpi-engine.service';
import { AnalyticsService }       from './services/analytics.service';
import { DashboardService }       from './services/dashboard.service';
import { ReportGeneratorService } from './services/report-generator.service';
import { ExportService }          from './services/export.service';
import { AlertService }           from './services/alert.service';
import { ReportingCacheService }  from './services/reporting-cache.service';
import { StatisticsService }      from './services/statistics.service';
import { AuditReportService }     from './services/audit-report.service';
import { ReportingEngine }        from './reporting.engine';

import {
  ReportFilter,
  ReportSection,
  ExportFormat,
  RoleFilter,
  ReportErreur,
  ReportErreurType,
  AlertType,
  AlertSeverity,
} from './types/reporting.types';

/* ============================================================
 * FACTORIES DE FILTRE
 * ============================================================ */

function makeFilter(overrides: Partial<ReportFilter> = {}): ReportFilter {
  const now    = new Date('2026-07-18T12:00:00Z');
  const month  = new Date('2026-06-18T00:00:00Z');
  return {
    dateFrom:            month,
    dateTo:              now,
    requestingUserId:    'user-super-admin',
    requestingUserRole:  RoleFilter.SUPER_ADMIN,
    page:                1,
    limit:               50,
    ...overrides,
  };
}

/* ============================================================
 * MOCK REPOSITORY — QueryBuilder fluent
 * ============================================================ */

function mockQb(rawResult: unknown[] = [], countResult = 0) {
  const qb: Record<string, jest.Mock> = {};
  const chainable = () => qb;

  for (const method of [
    'select', 'addSelect', 'where', 'andWhere', 'orWhere',
    'groupBy', 'orderBy', 'addOrderBy', 'limit', 'offset',
    'skip', 'take', 'leftJoin', 'innerJoin',
  ]) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }

  qb['getRawMany']      = jest.fn().mockResolvedValue(rawResult);
  qb['getRawOne']       = jest.fn().mockResolvedValue(rawResult[0] ?? null);
  qb['getMany']         = jest.fn().mockResolvedValue(rawResult);
  qb['getManyAndCount'] = jest.fn().mockResolvedValue([rawResult, countResult]);
  qb['getCount']        = jest.fn().mockResolvedValue(countResult);

  return qb;
}

function mockRepo(rawResult: unknown[] = [], countResult = 0) {
  const qb = mockQb(rawResult, countResult);
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    manager: {
      query: jest.fn().mockResolvedValue(rawResult),
    },
  };
}

/* ============================================================
 * GROUPE 1 — CALCUL DES KPIs
 * ============================================================ */

describe('KpiEngineService', () => {
  let service: KpiEngineService;

  const sessionRaw = [{
    montantTotal:    '500000',
    montantConfirme: '450000',
    montantRembourse:'10000',
    total:           '10',
    nbConfirmes:     '9',
    nbEchoues:       '1',
    nbExpires:       '0',
  }];

  const distRaw = [
    { acteurType: 'plateforme_produit',   montant: '15000', nb: '9' },
    { acteurType: 'plateforme_livraison', montant: '5000',  nb: '9' },
    { acteurType: 'entreprise',           montant: '380000',nb: '9' },
    { acteurType: 'livreur',              montant: '40000', nb: '9' },
  ];

  const walletRaw = [{
    totalWallets:  '50',
    walletsActifs: '48',
    walletsFrozen: '2',
    walletsFermes: '0',
    balanceTotale: '9000000',
    pendingTotal:  '1000000',
    blockedTotal:  '0',
    totalCredite:  '50000000',
    totalDebite:   '41000000',
  }];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KpiEngineService,
        ReportingCacheService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: mockRepo(sessionRaw) },
        { provide: getRepositoryToken(PaiementDistribution),
          useValue: mockRepo(distRaw) },
        { provide: getRepositoryToken(Wallet),
          useValue: mockRepo(walletRaw) },
        { provide: getRepositoryToken(Retrait),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Dispute),
          useValue: mockRepo([]) },
      ],
    }).compile();

    service = module.get(KpiEngineService);
  });

  it('calcule CA brut et CA net depuis les paiements confirmés', async () => {
    const kpi = await service.computeOverviewKpi(makeFilter());

    /* CA brut = montantConfirme */
    expect(kpi.chiffreAffairesBrut).toBe(450000);
    /* CA net = brut - rembourse */
    expect(kpi.chiffreAffairesNet).toBe(440000);
  });

  it('calcule le taux de réussite des paiements', async () => {
    const kpi = await service.computePaiementKpi(makeFilter());

    /* 9 confirmés / (9 + 1 + 0) = 90% */
    expect(kpi.tauxReussite).toBe(90);
  });

  it('calcule les commissions Shopi et les acteurs', async () => {
    const kpi = await service.computeCommissionKpi(makeFilter());

    expect(kpi.shopiProduit).toBe(15000);
    expect(kpi.shopiLivraison).toBe(5000);
    expect(kpi.shopiTotal).toBe(20000);
    expect(kpi.entreprises).toBe(380000);
    expect(kpi.livreurs).toBe(40000);
  });

  it('calcule le taux de litiges avec le bon dénominateur', async () => {
    /* Simuler 2 litiges pour 9 paiements confirmés */
    const disputeRaw = [{
      total:              '2',
      ouverts:            '1',
      enInstruction:      '1',
      resolus:            '0',
      fermes:             '0',
      montantConteste:    '30000',
      montantRembourse:   '20000',
      delaiMoyen:         '24',
    }];

    const module2: TestingModule = await Test.createTestingModule({
      providers: [
        KpiEngineService,
        ReportingCacheService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: mockRepo(sessionRaw) },
        { provide: getRepositoryToken(PaiementDistribution),
          useValue: mockRepo(distRaw) },
        { provide: getRepositoryToken(Wallet),
          useValue: mockRepo(walletRaw) },
        { provide: getRepositoryToken(Retrait),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Dispute),
          useValue: mockRepo(disputeRaw) },
      ],
    }).compile();

    const svc2 = module2.get(KpiEngineService);
    const kpi  = await svc2.computeDisputeKpi(makeFilter());

    /* taux = 2 / 9 * 100 ≈ 22.22% → arrondi à 22.22 */
    expect(kpi.total).toBe(2);
    expect(kpi.tauxLitiges).toBeGreaterThan(0);
  });
});

/* ============================================================
 * GROUPE 2 — DASHBOARDS PAR RÔLE
 * ============================================================ */

describe('DashboardService — cloisonnement par rôle', () => {
  let dashService: DashboardService;
  let kpiService:  KpiEngineService;

  const distRaw = [
    { acteurType: 'entreprise', montant: '200000', nb: '5',
      acteurUserId: 'ent-01', acteurNom: 'Shopi Market', commandeId: 'cmd-01' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingCacheService,
        KpiEngineService,
        AnalyticsService,
        AlertService,
        DashboardService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: mockRepo([{ montantConfirme: '200000', total: '5', nbConfirmes: '5', nbEchoues: '0', nbExpires: '0', montantTotal: '200000', montantRembourse: '0' }]) },
        { provide: getRepositoryToken(PaiementDistribution),
          useValue: mockRepo(distRaw) },
        { provide: getRepositoryToken(Wallet),
          useValue: mockRepo([{ totalWallets: '10', walletsActifs: '10', walletsFrozen: '0', walletsFermes: '0', balanceTotale: '500000', pendingTotal: '0', blockedTotal: '0', totalCredite: '1000000', totalDebite: '500000' }]) },
        { provide: getRepositoryToken(WalletTransaction),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Retrait),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Dispute),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(FinancialAuditLog),
          useValue: mockRepo([]) },
      ],
    }).compile();

    dashService = module.get(DashboardService);
    kpiService  = module.get(KpiEngineService);
  });

  it('Super Admin — dashboard contient kpis et alertes', async () => {
    const db = await dashService.getSuperAdminDashboard();

    expect(db).toHaveProperty('kpis');
    expect(db).toHaveProperty('alerts');
    expect(db.generatedAt).toBeInstanceOf(Date);
  });

  it('Entreprise — dashboard filtré par acteurUserId', async () => {
    const db = await dashService.getEntrepriseDashboard('ent-01');

    expect(db.role).toBe(RoleFilter.ENTREPRISE);
    expect(db.userId).toBe('ent-01');
    /* Le CA brut de l'entreprise vient de ses distributions RELEASED */
    expect(db.kpis).toHaveProperty('chiffreAffairesBrut');
  });

  it('Livreur — dashboard contient uniquement les distributions livraison', async () => {
    const db = await dashService.getLivreurDashboard('livreur-01');

    expect(db.role).toBe(RoleFilter.LIVREUR);
    expect(db.userId).toBe('livreur-01');
    /* Les revenus Shopi ne sont pas applicables à un livreur */
    expect(db.kpis?.revenusShopi).toBe(0);
  });
});

/* ============================================================
 * GROUPE 3 — ANALYTICS
 * ============================================================ */

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingCacheService,
        KpiEngineService,
        AnalyticsService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: mockRepo([
            { methode: 'ORANGE_MONEY', montant: '300000', nb: '6' },
            { methode: 'WAVE',         montant: '150000', nb: '3' },
          ]) },
        { provide: getRepositoryToken(PaiementDistribution),
          useValue: mockRepo([
            { acteurType: 'entreprise',        montant: '250000', nb: '6' },
            { acteurType: 'plateforme_produit', montant: '30000',  nb: '6' },
          ]) },
        { provide: getRepositoryToken(Wallet),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Retrait),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Dispute),
          useValue: mockRepo([]) },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  it('getRevenueTrend — retourne une série temporelle triée', async () => {
    const chart = await service.getRevenueTrend(makeFilter());

    expect(chart).toHaveProperty('labels');
    expect(chart).toHaveProperty('datasets');
    expect(Array.isArray(chart.datasets)).toBe(true);
  });

  it('getPaymentMethodBreakdown — retourne toutes les méthodes présentes', async () => {
    const chart = await service.getPaymentMethodBreakdown(makeFilter());

    expect(chart.labels).toContain('ORANGE_MONEY');
    expect(chart.labels).toContain('WAVE');
    expect(chart.datasets[0].data.length).toBe(chart.labels.length);
  });

  it('getGrowthAnalysis — compare période courante et précédente', async () => {
    const growth = await service.getGrowthAnalysis(makeFilter());

    expect(growth).toHaveProperty('currentPeriod');
    expect(growth).toHaveProperty('previousPeriod');
    expect(growth).toHaveProperty('growthRate');
    expect(growth).toHaveProperty('delta');
  });
});

/* ============================================================
 * GROUPE 4 — RAPPORTS ET EXPORTS
 * ============================================================ */

describe('ReportGeneratorService + ExportService', () => {
  let reportGen: ReportGeneratorService;
  let exportSvc: ExportService;

  const paiementRows = [
    { id: 'ps-01', commandeId: 'cmd-01', clientUserId: 'u-01',
      montant: '50000', devise: 'GNF', provider: 'INTERNAL',
      methode: 'WALLET', status: 'confirmed',
      createdAt: new Date('2026-07-01'), confirmedAt: new Date('2026-07-01') },
  ];

  beforeEach(async () => {
    const sessionQb = mockQb(paiementRows, 1);
    const sessionRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(sessionQb),
      manager: { query: jest.fn().mockResolvedValue([{ montantConfirme: '50000', total: '1', nbConfirmes: '1', nbEchoues: '0', nbExpires: '0', montantTotal: '50000', montantRembourse: '0' }]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingCacheService,
        KpiEngineService,
        AnalyticsService,
        ReportGeneratorService,
        ExportService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: sessionRepo },
        { provide: getRepositoryToken(PaiementDistribution),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Wallet),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Retrait),
          useValue: mockRepo([]) },
        { provide: getRepositoryToken(Dispute),
          useValue: mockRepo([]) },
      ],
    }).compile();

    reportGen = module.get(ReportGeneratorService);
    exportSvc = module.get(ExportService);
  });

  it('generateCustomReport — retourne un rapport avec la bonne période', async () => {
    const filter = makeFilter({ page: 1, limit: 10 });
    const report = await reportGen.generateCustomReport(ReportSection.PAIEMENTS, filter);

    expect(report.section).toBe(ReportSection.PAIEMENTS);
    expect(report.periode.from).toEqual(filter.dateFrom);
    expect(report.periode.to).toEqual(filter.dateTo);
    expect(typeof report.id).toBe('string');
    expect(report.id.length).toBeGreaterThan(0);
  });

  it('exportToCsv — contient les en-têtes CSV corrects', async () => {
    const result = await exportSvc.exportToCsv(ReportSection.PAIEMENTS, makeFilter());

    expect(result.format).toBe(ExportFormat.CSV);
    expect(result.filename).toMatch(/rapport_paiements_/);
    expect(typeof result.content).toBe('string');

    const lines = (result.content as string).split('\r\n');
    const header = lines[0];
    /* Vérifie que les colonnes clés sont présentes dans l'en-tête */
    expect(header).toContain('id');
    expect(header).toContain('commandeId');
    expect(header).toContain('montant');
    expect(header).toContain('status');
  });
});

/* ============================================================
 * GROUPE 5 — ALERTES
 * ============================================================ */

describe('AlertService — détection et déduplication', () => {
  let service: AlertService;

  /* Mocks retournant les données pour déclencher une alerte dispute */
  const disputeSpikeRepo = {
    createQueryBuilder: jest.fn(),
    manager: {
      query: jest.fn()
        .mockResolvedValueOnce([{ nb: '10' }])  /* current: 10 disputes */
        .mockResolvedValueOnce([{ nb: '2' }]),   /* previous: 2 disputes (+400%) */
    },
  };

  const emptyRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQb()),
    manager: { query: jest.fn().mockResolvedValue([{ nb: '0' }]) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertService,
        { provide: getRepositoryToken(PaiementSession),
          useValue: emptyRepo },
        { provide: getRepositoryToken(Dispute),
          useValue: disputeSpikeRepo },
        { provide: getRepositoryToken(Wallet),
          useValue: emptyRepo },
        { provide: getRepositoryToken(Retrait),
          useValue: emptyRepo },
      ],
    }).compile();

    service = module.get(AlertService);
  });

  it('déclenche une alerte DISPUTE_SPIKE quand les litiges augmentent fortement', async () => {
    const result = await service.runAllChecks();

    const disputeAlert = result.alerts.find(a => a.type === AlertType.DISPUTE_SPIKE);
    expect(disputeAlert).toBeDefined();
    expect(disputeAlert!.severity).toMatch(/critical|high/);
  });

  it('déduplication — la même alerte ne se déclenche pas deux fois dans la même heure', async () => {
    /* Première passe */
    const first  = await service.runAllChecks();
    const nbFirst = first.alerts.filter(a => a.type === AlertType.DISPUTE_SPIKE).length;

    /* Réinitialiser les mocks pour la deuxième passe */
    disputeSpikeRepo.manager.query
      .mockResolvedValueOnce([{ nb: '10' }])
      .mockResolvedValueOnce([{ nb: '2' }]);

    /* Deuxième passe dans la même heure */
    const second  = await service.runAllChecks();
    const nbSecond = second.alerts.filter(a => a.type === AlertType.DISPUTE_SPIKE).length;

    /* L'alerte active est déjà dans le store — pas de doublon */
    expect(nbFirst).toBe(1);
    expect(nbSecond).toBe(0);
  });
});

/* ============================================================
 * GROUPE 6 — CONTRÔLE D'ACCÈS (ReportingEngine)
 * ============================================================ */

describe('ReportingEngine — contrôle d\'accès par rôle', () => {
  let engine: ReportingEngine;

  function makeMinimalModule() {
    /* Services factices pour les tests de contrôle d'accès */
    const noopService = () => ({});

    return Test.createTestingModule({
      providers: [
        ReportingEngine,
        ReportingCacheService,
        KpiEngineService,
        AnalyticsService,
        AlertService,
        DashboardService,
        ReportGeneratorService,
        StatisticsService,
        ExportService,
        AuditReportService,
        { provide: getRepositoryToken(PaiementSession),      useValue: mockRepo() },
        { provide: getRepositoryToken(PaiementDistribution), useValue: mockRepo() },
        { provide: getRepositoryToken(Wallet),               useValue: mockRepo() },
        { provide: getRepositoryToken(WalletTransaction),    useValue: mockRepo() },
        { provide: getRepositoryToken(Retrait),              useValue: mockRepo() },
        { provide: getRepositoryToken(Dispute),              useValue: mockRepo() },
        { provide: getRepositoryToken(FinancialAuditLog),    useValue: mockRepo() },
      ],
    }).compile();
  }

  beforeEach(async () => {
    const module = await makeMinimalModule();
    engine = module.get(ReportingEngine);
  });

  it('LIVREUR — accès refusé à la section PAIEMENTS', async () => {
    const filter = makeFilter({
      requestingUserRole: RoleFilter.LIVREUR,
      requestingUserId:   'liv-01',
    });

    await expect(
      engine.generateReport(ReportSection.PAIEMENTS, filter),
    ).rejects.toThrow(ReportErreur);
  });

  it('ADMIN — accès autorisé à la section COMMISSIONS', async () => {
    const filter = makeFilter({
      requestingUserRole: RoleFilter.ADMIN,
      requestingUserId:   'admin-01',
      adminId:            'admin-01',
    });

    /* Ne doit pas lever d'erreur d'accès */
    await expect(
      engine.generateReport(ReportSection.COMMISSIONS, filter),
    ).resolves.toBeDefined();
  });

  it('Sans rôle — accès refusé par défaut (fail-secure)', async () => {
    const filter = makeFilter({ requestingUserRole: undefined });

    await expect(
      engine.generateReport(ReportSection.OVERVIEW, filter),
    ).rejects.toThrow(ReportErreur);
  });
});
