/* ============================================================
 * FICHIER : src/modules/resolution-engine/resolution.engine.spec.ts
 *
 * SUITE   : 12 scénarios couvrant l'ensemble du cycle de vie.
 * ============================================================ */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';

import { ResolutionEngine }         from './resolution.engine';
import { DisputeManagerService }    from './services/dispute-manager.service';
import { EvidenceManagerService }   from './services/evidence-manager.service';
import { DecisionManagerService }   from './services/decision-manager.service';
import { RefundManagerService }     from './services/refund-manager.service';
import { ResolutionHistoryService } from './services/resolution-history.service';
import { ResolutionAuditService }   from './services/resolution-audit.service';
import { ResolutionEventBus }       from './events/resolution-event-bus.service';

import { Dispute, DisputeStatus, DisputeDecision, DisputeMotif } from '../../database/entities/paiement/dispute.entity';
import { DisputeEvidence, EvidenceType, EvidenceSubmittedBy } from '../../database/entities/paiement/dispute-evidence.entity';
import { DisputeHistory } from '../../database/entities/paiement/dispute-history.entity';
import { Commande, CommandeStatus } from '../../database/entities/commande/commande.entity';
import { Escrow } from '../../database/entities/paiement/escrow.entity';
import { PaiementSession, PaiementSessionStatus } from '../../database/entities/paiement/paiement-session.entity';
import { PlatformSettings } from '../../database/entities/platform-settings.entity';
import { FinancialAuditLog } from '../../database/entities/paiement/financial-audit-log.entity';
import { EscrowEngine } from '../escrow-engine/escrow.engine';
import { PaymentProviderFactory } from '../paiement/providers/payment-provider.factory';

import {
  ResolutionErreur, ResolutionErreurType,
  DISPUTE_TRANSITIONS, DISPUTE_FINAL_STATES,
} from './types/resolution-engine.types';
import { RESOLUTION_EVENTS } from './events/resolution.events';

/* ── Helpers ──────────────────────────────────────────────── */
const mockRepo = () => ({
  findOne:  jest.fn(),
  find:     jest.fn(),
  count:    jest.fn().mockResolvedValue(0),
  create:   jest.fn().mockImplementation((v) => v),
  save:     jest.fn().mockImplementation((v) => Promise.resolve(v)),
  update:   jest.fn().mockResolvedValue({}),
  delete:   jest.fn().mockResolvedValue({}),
  createQueryBuilder: jest.fn().mockReturnValue({
    andWhere: jest.fn().mockReturnThis(),
    orderBy:  jest.fn().mockReturnThis(),
    skip:     jest.fn().mockReturnThis(),
    take:     jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  }),
});

const fakeDispute = (overrides: Partial<Dispute> = {}): Dispute => ({
  id:              'dsp-1',
  reference:       'DSP-2026-00001',
  commandeId:      'cmd-1',
  commandeNumero:  'CMD-2026-001',
  clientUserId:    'user-client',
  adminUserId:     null,
  savTicketId:     null,
  motif:           DisputeMotif.ARTICLE_NON_RECU,
  description:     'Test',
  montantConteste: 50000,
  status:          DisputeStatus.OPEN,
  decision:        null,
  decisionMotif:   null,
  montantRembourse: null,
  evidences:       [],
  openedAt:        new Date(),
  resolvedAt:      null,
  closedAt:        null,
  sessionId:       null,
  deadlineAt:      new Date(Date.now() + 48 * 3600 * 1000),
  escalatedAt:     null,
  createdAt:       new Date(),
  updatedAt:       new Date(),
  ...overrides,
} as Dispute);

const fakeCommande = (overrides: Partial<Commande> = {}): Partial<Commande> => ({
  id:      'cmd-1',
  numero:  'CMD-2026-001',
  status:  CommandeStatus.DELIVERED,
  clientId: 'client-prof-1',
  dateLivraisonEffective: new Date(Date.now() - 2 * 24 * 3600 * 1000),
  total: 50000,
  ...overrides,
});

const fakeSettings = (): Partial<PlatformSettings> => ({
  id: 1,
  disputeWindowDays: 7,
  maxEvidencesPerDispute: 10,
  disputeInstructionSlaHours: 48,
});

/* ── Builders de module ────────────────────────────────────── */
async function buildModule(repos: Record<string, any>, extras: Record<string, any> = {}): Promise<TestingModule> {
  const mockEscrowEngine = extras['EscrowEngine'] ?? {
    ouvrirLitige:   jest.fn().mockResolvedValue({}),
    resoudreLitige: jest.fn().mockResolvedValue({}),
  };
  const mockProviderFactory = extras['PaymentProviderFactory'] ?? {
    resolveByName: jest.fn().mockReturnValue({
      refund: jest.fn().mockResolvedValue({ providerRefundId: 'prov-rf-1' }),
    }),
  };
  const mockDataSource = extras['DataSource'] ?? {
    transaction: jest.fn().mockImplementation(async (fn: any) => fn({
      create: (_: any, v: any) => ({ ...v, id: 'new-id' }),
      save:   jest.fn().mockImplementation((_, v) => Promise.resolve({ ...v, id: 'new-id' })),
      update: jest.fn().mockResolvedValue({}),
    })),
  };

  return Test.createTestingModule({
    providers: [
      ResolutionEngine,
      DisputeManagerService,
      EvidenceManagerService,
      DecisionManagerService,
      RefundManagerService,
      ResolutionHistoryService,
      ResolutionAuditService,
      ResolutionEventBus,
      { provide: getRepositoryToken(Dispute),          useValue: repos['Dispute']          ?? mockRepo() },
      { provide: getRepositoryToken(DisputeEvidence),  useValue: repos['DisputeEvidence']  ?? mockRepo() },
      { provide: getRepositoryToken(DisputeHistory),   useValue: repos['DisputeHistory']   ?? mockRepo() },
      { provide: getRepositoryToken(Commande),         useValue: repos['Commande']         ?? mockRepo() },
      { provide: getRepositoryToken(Escrow),           useValue: repos['Escrow']           ?? mockRepo() },
      { provide: getRepositoryToken(PaiementSession),  useValue: repos['PaiementSession']  ?? mockRepo() },
      { provide: getRepositoryToken(PlatformSettings), useValue: repos['PlatformSettings'] ?? mockRepo() },
      { provide: getRepositoryToken(FinancialAuditLog), useValue: repos['FinancialAuditLog'] ?? mockRepo() },
      { provide: EscrowEngine,          useValue: mockEscrowEngine },
      { provide: PaymentProviderFactory, useValue: mockProviderFactory },
      { provide: DataSource,            useValue: mockDataSource },
    ],
  }).compile();
}

/* ════════════════════════════════════════════════════════════
 * SUITE 1 — MACHINE À ÉTATS
 * ════════════════════════════════════════════════════════════ */

describe('Suite 1 — Machine à états', () => {

  it('T1 : DISPUTE_TRANSITIONS couvre tous les statuts DisputeStatus', () => {
    for (const s of Object.values(DisputeStatus)) {
      expect(DISPUTE_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('T2 : CLOSED est le seul état final irréversible', () => {
    expect(DISPUTE_FINAL_STATES.has(DisputeStatus.CLOSED)).toBe(true);
    expect(DISPUTE_FINAL_STATES.size).toBe(1);
  });

  it('T3 : Transitions DECISION_PENDING autorisées : APPROVED et REJECTED uniquement', () => {
    const allowed = DISPUTE_TRANSITIONS[DisputeStatus.DECISION_PENDING];
    expect(allowed).toContain(DisputeStatus.APPROVED);
    expect(allowed).toContain(DisputeStatus.REJECTED);
    expect(allowed).toHaveLength(2);
  });

  it('T4 : Transition CLOSED → toute autre est interdite (état final)', () => {
    const allowed = DISPUTE_TRANSITIONS[DisputeStatus.CLOSED];
    expect(allowed).toHaveLength(0);
  });
});

/* ════════════════════════════════════════════════════════════
 * SUITE 2 — OUVERTURE D'UN LITIGE
 * ════════════════════════════════════════════════════════════ */

describe('Suite 2 — Ouverture de litige', () => {

  it('T5 : Lance COMMANDE_INTROUVABLE si la commande n'existe pas', async () => {
    const commandeRepo = mockRepo();
    commandeRepo.findOne.mockResolvedValue(null);
    const module = await buildModule({ Commande: commandeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.ouvrirDispute({
      commandeId: 'missing', clientUserId: 'u1',
      motif: DisputeMotif.ARTICLE_NON_RECU,
      description: 'Test', montantConteste: 10000,
    })).rejects.toMatchObject({ type: ResolutionErreurType.COMMANDE_INTROUVABLE });
  });

  it('T6 : Lance COMMANDE_NON_LIVREE si la commande est en PENDING', async () => {
    const commandeRepo = mockRepo();
    const settingsRepo = mockRepo();
    commandeRepo.findOne.mockResolvedValue(fakeCommande({ status: CommandeStatus.PENDING }));
    settingsRepo.findOne.mockResolvedValue(fakeSettings());
    const module = await buildModule({ Commande: commandeRepo, PlatformSettings: settingsRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.ouvrirDispute({
      commandeId: 'cmd-1', clientUserId: 'u1',
      motif: DisputeMotif.ARTICLE_NON_RECU,
      description: 'Test', montantConteste: 10000,
    })).rejects.toMatchObject({ type: ResolutionErreurType.COMMANDE_NON_LIVREE });
  });

  it('T7 : Lance FENETRE_EXPIREE si la livraison date de plus de 7 jours', async () => {
    const commandeRepo = mockRepo();
    const settingsRepo = mockRepo();
    const disputeRepo  = mockRepo();
    commandeRepo.findOne.mockResolvedValue(fakeCommande({
      status: CommandeStatus.DELIVERED,
      dateLivraisonEffective: new Date(Date.now() - 10 * 24 * 3600 * 1000),
    }));
    settingsRepo.findOne.mockResolvedValue(fakeSettings());
    disputeRepo.findOne.mockResolvedValue(null);
    const module = await buildModule({ Commande: commandeRepo, PlatformSettings: settingsRepo, Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.ouvrirDispute({
      commandeId: 'cmd-1', clientUserId: 'u1',
      motif: DisputeMotif.ARTICLE_NON_RECU,
      description: 'Test', montantConteste: 10000,
    })).rejects.toMatchObject({ type: ResolutionErreurType.FENETRE_EXPIREE });
  });

  it('T8 : Lance DISPUTE_DEJA_ACTIF si un litige actif existe déjà', async () => {
    const commandeRepo = mockRepo();
    const settingsRepo = mockRepo();
    const disputeRepo  = mockRepo();
    commandeRepo.findOne.mockResolvedValue(fakeCommande());
    settingsRepo.findOne.mockResolvedValue(fakeSettings());
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.UNDER_REVIEW }));
    disputeRepo.count.mockResolvedValue(1);
    const module = await buildModule({ Commande: commandeRepo, PlatformSettings: settingsRepo, Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.ouvrirDispute({
      commandeId: 'cmd-1', clientUserId: 'u1',
      motif: DisputeMotif.ARTICLE_NON_RECU,
      description: 'Test', montantConteste: 10000,
    })).rejects.toMatchObject({ type: ResolutionErreurType.DISPUTE_DEJA_ACTIF });
  });
});

/* ════════════════════════════════════════════════════════════
 * SUITE 3 — GESTION DES PREUVES
 * ════════════════════════════════════════════════════════════ */

describe('Suite 3 — Gestion des preuves', () => {

  it('T9 : Refuse de soumettre une preuve sur un litige CLOSED', async () => {
    const disputeRepo  = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.CLOSED }));
    const module = await buildModule({ Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.soumettrePreuve({
      disputeId: 'dsp-1', uploadedByUserId: 'u1',
      submittedBy: EvidenceSubmittedBy.CLIENT,
      type: EvidenceType.PHOTO, url: 'https://cdn.test/img.jpg',
    })).rejects.toMatchObject({ type: ResolutionErreurType.ETAT_FINAL_IRREVOCABLE });
  });

  it('T10 : Lance MAX_EVIDENCES_ATTEINT si la limite est dépassée', async () => {
    const disputeRepo   = mockRepo();
    const evidenceRepo  = mockRepo();
    const settingsRepo  = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.UNDER_REVIEW }));
    settingsRepo.findOne.mockResolvedValue({ ...fakeSettings(), maxEvidencesPerDispute: 3 });
    evidenceRepo.count.mockResolvedValue(3);
    const module = await buildModule({ Dispute: disputeRepo, DisputeEvidence: evidenceRepo, PlatformSettings: settingsRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.soumettrePreuve({
      disputeId: 'dsp-1', uploadedByUserId: 'u1',
      submittedBy: EvidenceSubmittedBy.CLIENT,
      type: EvidenceType.PHOTO, url: 'https://cdn.test/img.jpg',
    })).rejects.toMatchObject({ type: ResolutionErreurType.MAX_EVIDENCES_ATTEINT });
  });
});

/* ════════════════════════════════════════════════════════════
 * SUITE 4 — DÉCISION
 * ════════════════════════════════════════════════════════════ */

describe('Suite 4 — Décision', () => {

  it('T11 : Refuse si statut ≠ DECISION_PENDING', async () => {
    const disputeRepo = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.UNDER_REVIEW }));
    const module = await buildModule({ Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.rendreDecision({
      disputeId: 'dsp-1', adminUserId: 'admin-1',
      decision: DisputeDecision.REJET, decisionMotif: 'Insuffisant',
    })).rejects.toMatchObject({ type: ResolutionErreurType.TRANSITION_INVALIDE });
  });

  it('T12 : Refuse REMBOURSEMENT_PARTIEL sans montant', async () => {
    const disputeRepo = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.DECISION_PENDING, decision: null }));
    const module = await buildModule({ Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.rendreDecision({
      disputeId: 'dsp-1', adminUserId: 'admin-1',
      decision: DisputeDecision.REMBOURSEMENT_PARTIEL,
      decisionMotif: 'Partiel',
    })).rejects.toMatchObject({ type: ResolutionErreurType.MONTANT_INVALIDE });
  });

  it('T13 : Appelle EscrowEngine.resoudreLitige avec decision=REJET', async () => {
    const disputeRepo = mockRepo();
    const escrowRepo  = mockRepo();
    const mockEscrowEngine = { ouvrirLitige: jest.fn(), resoudreLitige: jest.fn().mockResolvedValue({}) };
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.DECISION_PENDING, decision: null }));
    disputeRepo.update.mockResolvedValue({});
    escrowRepo.findOne.mockResolvedValue({ id: 'escrow-1', commandeId: 'cmd-1' });

    const module = await buildModule(
      { Dispute: disputeRepo, Escrow: escrowRepo },
      { EscrowEngine: mockEscrowEngine },
    );
    const engine = module.get(ResolutionEngine);

    await engine.rendreDecision({
      disputeId: 'dsp-1', adminUserId: 'admin-1',
      decision: DisputeDecision.REJET,
      decisionMotif: 'Preuve insuffisante',
    });

    expect(mockEscrowEngine.resoudreLitige).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'REJET', disputeId: 'dsp-1' }),
    );
  });

  it('T14 : Immuabilité — erreur si décision déjà rendue', async () => {
    const disputeRepo = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({
      status: DisputeStatus.DECISION_PENDING,
      decision: DisputeDecision.REJET,
    }));
    const module = await buildModule({ Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.rendreDecision({
      disputeId: 'dsp-1', adminUserId: 'admin-1',
      decision: DisputeDecision.REMBOURSEMENT_TOTAL,
      decisionMotif: 'Changement',
    })).rejects.toMatchObject({ type: ResolutionErreurType.DECISION_DEJA_RENDUE });
  });
});

/* ════════════════════════════════════════════════════════════
 * SUITE 5 — REMBOURSEMENT ET ÉVÉNEMENTS
 * ════════════════════════════════════════════════════════════ */

describe('Suite 5 — Remboursement et événements', () => {

  it('T15 : Refuse si statut ≠ REFUND_PENDING', async () => {
    const disputeRepo = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({ status: DisputeStatus.APPROVED }));
    const module = await buildModule({ Dispute: disputeRepo });
    const engine = module.get(ResolutionEngine);

    await expect(engine.traiterRemboursement({ disputeId: 'dsp-1', adminUserId: 'admin-1' }))
      .rejects.toMatchObject({ type: ResolutionErreurType.TRANSITION_INVALIDE });
  });

  it('T16 : Émet REFUND_COMPLETED et RESOLUTION_CLOSED sur succès', async () => {
    const disputeRepo = mockRepo();
    const sessionRepo = mockRepo();
    disputeRepo.findOne.mockResolvedValue(fakeDispute({
      status: DisputeStatus.REFUND_PENDING,
      montantRembourse: 50000,
      decision: DisputeDecision.REMBOURSEMENT_TOTAL,
    }));
    disputeRepo.update.mockResolvedValue({});
    sessionRepo.findOne.mockResolvedValue({
      id: 'sess-1', provider: 'internal',
      providerTransactionId: 'tx-123',
      status: PaiementSessionStatus.CONFIRMED,
    });
    sessionRepo.update.mockResolvedValue({});

    const module = await buildModule({ Dispute: disputeRepo, PaiementSession: sessionRepo });
    const engine   = module.get(ResolutionEngine);
    const eventBus = module.get(ResolutionEventBus);

    const emitted: string[] = [];
    eventBus.on(RESOLUTION_EVENTS.REFUND_COMPLETED,  () => emitted.push('refund'));
    eventBus.on(RESOLUTION_EVENTS.RESOLUTION_CLOSED, () => emitted.push('closed'));

    await engine.traiterRemboursement({ disputeId: 'dsp-1', adminUserId: 'admin-1' });

    expect(emitted).toContain('refund');
    expect(emitted).toContain('closed');
  });
});
