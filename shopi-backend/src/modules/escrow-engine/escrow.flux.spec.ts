/* ============================================================
 * FICHIER : src/modules/escrow-engine/escrow.flux.spec.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Tests de bout en bout du séquestre avec les VRAIS services
 * (EscrowEngine, Manager, Release, Refund, Validator). Seuls la base
 * de données et les wallets sont simulés — les wallets par une petite
 * "banque" en mémoire qui applique les mêmes règles que WalletEngine
 * (pending / balance, idempotence par clé).
 *
 * INVARIANT CENTRAL
 * ─────────────────────────────────────────────────────────────
 *   L'argent payé par le client (montantTotal, reçu du provider) se
 *   retrouve EXACTEMENT dans les wallets à la fin — jamais plus
 *   (création d'argent), jamais moins (argent perdu ou bloqué).
 *
 * GROUPES
 * ─────────────────────────────────────────────────────────────
 *  1. Cycle nominal : création → fonds reçus → verrouillage →
 *     attente de validation → libération aux vendeurs/livreurs
 *  2. Robustesse : reprises après panne sans double paiement
 *  3. Remboursement total
 *  4. Litiges : ouverture, résolution (rejet / remboursement)
 *  5. Règles de la machine à états
 *  6. BUGS CONNUS (test.failing) — remboursement partiel / re-livraison
 * ============================================================ */

import { EscrowEngine } from './escrow.engine';
import { EscrowManagerService } from './services/escrow-manager.service';
import { EscrowReleaseService } from './services/escrow-release.service';
import { EscrowRefundService } from './services/escrow-refund.service';
import { EscrowValidatorService } from './services/escrow-validator.service';
import { EscrowEventBus } from './events/escrow-event-bus.service';
import { Escrow, EscrowStatus, EscrowTrigger } from '../../database/entities/paiement/escrow.entity';
import { DistributionStatus } from '../../database/entities/paiement/paiement-distribution.entity';
import { EscrowErreur, EscrowErreurType } from './types/escrow-engine.types';
import { WalletOperationType } from '../wallet-engine/types/wallet-engine.types';

/* ============================================================
 * BANQUE SIMULÉE (remplace WalletEngine)
 * ============================================================ */

class BanqueSimulee {
  readonly comptes = new Map<string, { balance: number; pending: number }>();
  readonly clesVues = new Set<string>();
  /** Si défini, fait échouer l'opération sur ce wallet (une seule fois). */
  panneSur: string | null = null;
  private n = 0;

  compte(id: string) {
    if (!this.comptes.has(id)) this.comptes.set(id, { balance: 0, pending: 0 });
    return this.comptes.get(id)!;
  }

  /** Argent total présent dans tous les wallets */
  total(): number {
    let t = 0;
    for (const c of this.comptes.values()) t += c.balance + c.pending;
    return t;
  }

  executer = jest.fn(async (ctx: { walletId: string; amount: number; operationType: WalletOperationType; idempotencyKey?: string }) => {
    if (this.panneSur === ctx.walletId) {
      this.panneSur = null;
      throw new Error('panne réseau simulée');
    }
    if (ctx.idempotencyKey && this.clesVues.has(ctx.idempotencyKey)) {
      return { transactionId: `tx-dup-${ctx.idempotencyKey}` };
    }
    const c = this.compte(ctx.walletId);
    switch (ctx.operationType) {
      case WalletOperationType.ESCROW_CREDIT: c.pending += ctx.amount; break;
      case WalletOperationType.ESCROW_RELEASE:
        if (c.pending < ctx.amount) throw new Error('SOLDE_SOURCE_INSUFFISANT');
        c.pending -= ctx.amount; c.balance += ctx.amount; break;
      case WalletOperationType.ESCROW_CANCEL:
        if (c.pending < ctx.amount) throw new Error('SOLDE_SOURCE_INSUFFISANT');
        c.pending -= ctx.amount; break;
      case WalletOperationType.REFUND: c.balance += ctx.amount; break;
      default: throw new Error(`opération non simulée : ${ctx.operationType}`);
    }
    if (ctx.idempotencyKey) this.clesVues.add(ctx.idempotencyKey);
    return { transactionId: `tx-${++this.n}` };
  });
}

/* ============================================================
 * MONTAGE (repos en mémoire + vrais services)
 * ============================================================ */

const MONTANT = 115_000;
/* Répartition typique : entreprise, livreur, plateforme — somme = MONTANT */
const PARTS: Array<[string, string, number]> = [
  ['dist-ent', 'wallet-entreprise', 94_000],
  ['dist-liv', 'wallet-livreur',    13_500],
  ['dist-pla', 'wallet-plateforme',  7_500],
];

function monter(options: { delaiValidationJours?: number | null } = {}) {
  const banque = new BanqueSimulee();
  const escrows = new Map<string, Escrow>();
  const historique: Array<{ fromStatus: string | null; toStatus: string }> = [];
  const distributions = PARTS.map(([id, walletId, montant]) => ({
    id, walletId, montant, commandeId: 'cmd-1', acteurType: id, acteurNom: id,
    status: DistributionStatus.ESCROW,
  })) as any[];

  let seq = 0;
  const escrowRepo = {
    create: jest.fn((d: Partial<Escrow>) => ({ ...d })),
    save: jest.fn(async (e: Escrow) => {
      if (!e.id) e.id = `escrow-${++seq}`;
      escrows.set(e.id, e);
      return e;
    }),
    findOne: jest.fn(async ({ where }: { where: Partial<Escrow> }) =>
      [...escrows.values()].find(e =>
        (where.id === undefined || e.id === where.id) &&
        (where.sessionId === undefined || e.sessionId === where.sessionId)) ?? null),
  };
  const historyRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (h: any) => { historique.push(h); return h; }),
  };
  const distributionRepo = {
    find: jest.fn(async ({ where }: any) =>
      distributions.filter(d => d.commandeId === where.commandeId && d.status === where.status)),
    save: jest.fn(async (d: any) => d),
  };
  const settingsRepo = {
    findOne: jest.fn(async () =>
      options.delaiValidationJours === null ? null : { escrowClientValidationDelayDays: options.delaiValidationJours ?? 3 }),
  };
  const walletRepo = { findOne: jest.fn(async () => ({ id: 'wallet-client' })) };

  const validator = new EscrowValidatorService();
  const events = new EscrowEventBus();
  const emit = jest.spyOn(events, 'emit');
  const manager = new EscrowManagerService(
    escrowRepo as any, historyRepo as any, distributionRepo as any, settingsRepo as any, banque as any, validator, events,
  );
  const release = new EscrowReleaseService(
    escrowRepo as any, historyRepo as any, distributionRepo as any, banque as any, validator, events, {} as any,
  );
  const refund = new EscrowRefundService(
    escrowRepo as any, historyRepo as any, distributionRepo as any, walletRepo as any, banque as any, validator, events,
  );
  const audit = { logCreation: jest.fn(), logRelease: jest.fn(), logRefund: jest.fn(), logErreur: jest.fn() };
  const engine = new EscrowEngine(
    escrowRepo as any, historyRepo as any, manager, release, refund, {} as any, audit as any, validator, events,
  );

  return { engine, banque, escrows, historique, distributions, emit, audit, escrowRepo };
}

type Monte = ReturnType<typeof monter>;

/** Crée l'escrow et le fait avancer jusqu'à l'état voulu (chemin nominal). */
async function amenerA(m: Monte, cible: EscrowStatus): Promise<Escrow> {
  const e = await m.engine.creer({
    commandeId: 'cmd-1', commandeNumero: 'CMD-001', sessionId: 'session-1',
    clientUserId: 'client-1', clientWalletId: 'wallet-client', montantTotal: MONTANT, currency: 'GNF',
  });
  if (cible === EscrowStatus.CREATED) return e;
  await m.engine.recevoirFonds({ escrowId: e.id, sessionId: 'session-1', montantConfirme: MONTANT, provider: 'orange' });
  if (cible === EscrowStatus.FUNDS_RECEIVED) return e;
  await m.engine.verrouillerFonds({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM });
  if (cible === EscrowStatus.LOCKED) return e;
  await m.engine.attendreValidation({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM });
  if (cible === EscrowStatus.WAITING_VALIDATION) return e;
  await m.engine.ouvrirLitige({ escrowId: e.id, disputeId: 'litige-1', triggeredByUserId: 'client-1' });
  return e;
}

async function attendreErreur(p: Promise<unknown>, type: EscrowErreurType) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(EscrowErreur);
  expect((err as EscrowErreur).type).toBe(type);
}

const solde = (m: Monte, w: string) => m.banque.compte(w);

/* ============================================================
 * 1. CYCLE NOMINAL
 * ============================================================ */

describe('Séquestre — cycle nominal', () => {

  it('verrouillage : chaque acteur reçoit sa part EN ATTENTE (pas encore retirable)', async () => {
    const m = monter();
    await amenerA(m, EscrowStatus.LOCKED);

    for (const [, w, montant] of PARTS) {
      expect(solde(m, w)).toEqual({ pending: montant, balance: 0 });
    }
    expect(m.banque.total()).toBe(MONTANT);
  });

  it("libération : l'argent en attente devient disponible, exactement le montant payé", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);

    const r = await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.CLIENT, triggeredByUserId: 'client-1', releaseReason: 'client-confirme' });

    for (const [, w, montant] of PARTS) {
      expect(solde(m, w)).toEqual({ pending: 0, balance: montant });
    }
    expect(r.montantDistribue).toBe(MONTANT);
    expect(r.nbActeurs).toBe(3);
    expect(m.banque.total()).toBe(MONTANT);
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.RELEASED);
    expect(m.distributions.every(d => d.status === DistributionStatus.RELEASED)).toBe(true);
    expect(m.audit.logRelease).toHaveBeenCalled();
  });

  it("chaque étape est tracée dans l'historique, dans l'ordre", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' });

    expect(m.historique.map(h => h.toStatus)).toEqual([
      EscrowStatus.CREATED, EscrowStatus.FUNDS_RECEIVED, EscrowStatus.LOCKED,
      EscrowStatus.WAITING_VALIDATION, EscrowStatus.RELEASED,
    ]);
  });

  it('attente de validation : libération automatique programmée selon le délai plateforme', async () => {
    const m = monter({ delaiValidationJours: 5 });
    const avant = Date.now();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);

    const auto = m.escrows.get(e.id)!.autoReleaseAt!.getTime();
    const jours = (auto - avant) / 86_400_000;
    expect(jours).toBeGreaterThan(4.99);
    expect(jours).toBeLessThan(5.01);
  });

  it('sans paramètres plateforme : délai de validation par défaut de 3 jours', async () => {
    const m = monter({ delaiValidationJours: null });
    const avant = Date.now();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    const jours = (m.escrows.get(e.id)!.autoReleaseAt!.getTime() - avant) / 86_400_000;
    expect(Math.round(jours)).toBe(3);
  });

  it('création idempotente : une 2ᵉ création pour la même session renvoie le même séquestre', async () => {
    const m = monter();
    const a = await amenerA(m, EscrowStatus.CREATED);
    const b = await amenerA(m, EscrowStatus.CREATED);
    expect(b.id).toBe(a.id);
    expect(m.escrows.size).toBe(1);
  });

  it.each([0, -1, NaN])('création refusée pour un montant invalide (%p)', async (montantTotal) => {
    const m = monter();
    await attendreErreur(m.engine.creer({
      commandeId: 'c', commandeNumero: 'C', sessionId: `s-${montantTotal}`, clientUserId: 'u',
      clientWalletId: 'w', montantTotal, currency: 'GNF',
    }), EscrowErreurType.MONTANT_INVALIDE);
  });

  it('fonds reçus : montant confirmé incohérent refusé, écart ≤ 1 GNF toléré (arrondi)', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.CREATED);

    await attendreErreur(
      m.engine.recevoirFonds({ escrowId: e.id, sessionId: 'session-1', montantConfirme: MONTANT - 500, provider: 'orange' }),
      EscrowErreurType.MONTANT_INVALIDE,
    );
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.CREATED);

    await m.engine.recevoirFonds({ escrowId: e.id, sessionId: 'session-1', montantConfirme: MONTANT - 1, provider: 'orange' });
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.FUNDS_RECEIVED);
  });

  it('séquestre introuvable : ESCROW_INTROUVABLE', async () => {
    const m = monter();
    await attendreErreur(
      m.engine.recevoirFonds({ escrowId: 'absent', sessionId: 's', montantConfirme: 1, provider: 'x' }),
      EscrowErreurType.ESCROW_INTROUVABLE,
    );
  });
});

/* ============================================================
 * 2. ROBUSTESSE — reprises sans double paiement
 * ============================================================ */

describe('Séquestre — reprises après panne', () => {

  it('double libération interdite : les acteurs ne sont jamais payés deux fois', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' });

    await attendreErreur(
      m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' }),
      EscrowErreurType.DOUBLE_RELEASE,
    );
    expect(m.banque.total()).toBe(MONTANT);
  });

  it('verrouillage interrompu puis relancé : chaque acteur crédité une seule fois', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.FUNDS_RECEIVED);

    m.banque.panneSur = 'wallet-livreur';
    await expect(m.engine.verrouillerFonds({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM })).rejects.toThrow();
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.FUNDS_RECEIVED);

    await m.engine.verrouillerFonds({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM });

    expect(solde(m, 'wallet-entreprise').pending).toBe(94_000);
    expect(solde(m, 'wallet-livreur').pending).toBe(13_500);
    expect(m.banque.total()).toBe(MONTANT);
  });

  it('libération interrompue puis relancée : termine sans double paiement', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);

    m.banque.panneSur = 'wallet-livreur';
    await attendreErreur(
      m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' }),
      EscrowErreurType.WALLET_ENGINE_ERREUR,
    );
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.WAITING_VALIDATION);

    await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' });

    for (const [, w, montant] of PARTS) {
      expect(solde(m, w)).toEqual({ pending: 0, balance: montant });
    }
    expect(m.banque.total()).toBe(MONTANT);
  });

  it('un second verrouillage est refusé (pas de double crédit en attente)', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.LOCKED);
    await attendreErreur(
      m.engine.verrouillerFonds({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM }),
      EscrowErreurType.TRANSITION_INVALIDE,
    );
    expect(m.banque.total()).toBe(MONTANT);
  });
});

/* ============================================================
 * 3. REMBOURSEMENT TOTAL
 * ============================================================ */

describe('Séquestre — remboursement total', () => {

  it("annule les parts en attente et rend TOUT au client : aucun argent créé ni perdu", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);

    const r = await m.engine.rembourser({
      escrowId: e.id, triggeredBy: EscrowTrigger.ADMIN, triggeredByUserId: 'admin-1', total: true, raison: 'produit non livré',
    });

    for (const [, w] of PARTS) expect(solde(m, w)).toEqual({ pending: 0, balance: 0 });
    expect(solde(m, 'wallet-client').balance).toBe(MONTANT);
    expect(r.montantRembourse).toBe(MONTANT);
    expect(m.banque.total()).toBe(MONTANT);
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.REFUNDED);
    expect(m.distributions.every(d => d.status === DistributionStatus.CANCELLED)).toBe(true);
  });

  it('double remboursement interdit', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    const ctx = { escrowId: e.id, triggeredBy: EscrowTrigger.ADMIN, total: true, raison: 'x' };
    await m.engine.rembourser(ctx);

    await attendreErreur(m.engine.rembourser(ctx), EscrowErreurType.DOUBLE_REFUND);
    expect(solde(m, 'wallet-client').balance).toBe(MONTANT);
  });

  it('impossible de rembourser un séquestre déjà libéré aux vendeurs', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' });

    await attendreErreur(
      m.engine.rembourser({ escrowId: e.id, triggeredBy: EscrowTrigger.ADMIN, total: true, raison: 'x' }),
      EscrowErreurType.ETAT_FINAL_IRREVOCABLE,
    );
    expect(solde(m, 'wallet-client').balance).toBe(0);
  });

  it('remboursement partiel supérieur au montant payé : refusé', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await attendreErreur(
      m.engine.rembourser({ escrowId: e.id, triggeredBy: EscrowTrigger.ADMIN, total: false, montantRembourse: MONTANT + 1, raison: 'x' }),
      EscrowErreurType.MONTANT_INSUFFISANT,
    );
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.WAITING_VALIDATION);
  });

  it("wallet client introuvable (ni snapshot ni wallet en base) : erreur explicite, séquestre inchangé côté vendeurs", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    m.escrows.get(e.id)!.clientWalletId = null as any;
    (m as any).engine['refundSvc']['walletRepo'].findOne.mockResolvedValue(null);

    await attendreErreur(
      m.engine.rembourser({ escrowId: e.id, triggeredBy: EscrowTrigger.ADMIN, total: false, montantRembourse: 1_000, raison: 'x' }),
      EscrowErreurType.WALLET_ENGINE_ERREUR,
    );
  });
});

/* ============================================================
 * 4. LITIGES
 * ============================================================ */

describe('Séquestre — litiges', () => {

  it('un litige gèle la libération tant qu’il n’est pas résolu', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.DISPUTED);

    expect(m.escrows.get(e.id)!).toMatchObject({ status: EscrowStatus.DISPUTED, disputeId: 'litige-1' });
    await attendreErreur(
      m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' }),
      EscrowErreurType.TRANSITION_INVALIDE,
    );
    for (const [, w] of PARTS) expect(solde(m, w).balance).toBe(0);
  });

  it("litige impossible avant la livraison (séquestre seulement verrouillé)", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.LOCKED);
    await attendreErreur(
      m.engine.ouvrirLitige({ escrowId: e.id, disputeId: 'l', triggeredByUserId: 'client-1' }),
      EscrowErreurType.TRANSITION_INVALIDE,
    );
  });

  it("résolution impossible sans litige ouvert", async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await attendreErreur(
      m.engine.resoudreLitige({ escrowId: e.id, disputeId: 'l', decision: 'REJET', adminUserId: 'admin-1', note: 'n' }),
      EscrowErreurType.LITIGE_NON_RESOLU,
    );
  });

  it('décision REJET : les vendeurs et livreurs sont payés', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.DISPUTED);

    await m.engine.resoudreLitige({ escrowId: e.id, disputeId: 'litige-1', decision: 'REJET', adminUserId: 'admin-1', note: 'litige non fondé' });

    for (const [, w, montant] of PARTS) expect(solde(m, w)).toEqual({ pending: 0, balance: montant });
    expect(solde(m, 'wallet-client').balance).toBe(0);
    expect(m.escrows.get(e.id)!).toMatchObject({ status: EscrowStatus.RELEASED, disputeDecision: 'REJET', adminDecisionUserId: 'admin-1' });
  });

  it('décision REMBOURSEMENT_TOTAL : le client récupère tout, les parts sont annulées', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.DISPUTED);

    await m.engine.resoudreLitige({ escrowId: e.id, disputeId: 'litige-1', decision: 'REMBOURSEMENT_TOTAL', adminUserId: 'admin-1', note: 'colis perdu' });

    expect(solde(m, 'wallet-client').balance).toBe(MONTANT);
    for (const [, w] of PARTS) expect(solde(m, w)).toEqual({ pending: 0, balance: 0 });
    expect(m.banque.total()).toBe(MONTANT);
    expect(m.escrows.get(e.id)!.status).toBe(EscrowStatus.REFUNDED);
  });
});

/* ============================================================
 * 5. MACHINE À ÉTATS
 * ============================================================ */

describe('Séquestre — règles de la machine à états', () => {

  it('libération impossible avant la validation (fonds seulement verrouillés)', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.LOCKED);
    await attendreErreur(
      m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'x' }),
      EscrowErreurType.TRANSITION_INVALIDE,
    );
    for (const [, w, montant] of PARTS) expect(solde(m, w).pending).toBe(montant);
  });

  it("expiration : seulement si le paiement n'est jamais arrivé", async () => {
    const m = monter();
    const cree = await amenerA(m, EscrowStatus.CREATED);
    await m.engine.marquerExpire(cree.id);
    expect(m.escrows.get(cree.id)!.status).toBe(EscrowStatus.EXPIRED);

    const m2 = monter();
    const paye = await amenerA(m2, EscrowStatus.FUNDS_RECEIVED);
    await attendreErreur(m2.engine.marquerExpire(paye.id), EscrowErreurType.TRANSITION_INVALIDE);
  });

  it('échec : trace la raison et journalise une erreur d’audit', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.LOCKED);
    await m.engine.marquerEchoue({ escrowId: e.id, failureReason: 'provider indisponible' });

    expect(m.escrows.get(e.id)!).toMatchObject({ status: EscrowStatus.FAILED, failureReason: 'provider indisponible' });
    expect(m.audit.logErreur).toHaveBeenCalledWith(expect.objectContaining({ erreur: 'provider indisponible' }));
  });

  it.each([EscrowStatus.RELEASED, EscrowStatus.REFUNDED, EscrowStatus.FAILED, EscrowStatus.EXPIRED])(
    'état final %s : plus aucune transition possible',
    (status) => {
      const v = new EscrowValidatorService();
      for (const cible of Object.values(EscrowStatus)) {
        expect(() => v.validerTransition({ id: 'e', status } as Escrow, cible))
          .toThrow(expect.objectContaining({ type: EscrowErreurType.ETAT_FINAL_IRREVOCABLE }));
      }
    },
  );

  it('les événements sont émis à chaque étape du cycle', async () => {
    const m = monter();
    const e = await amenerA(m, EscrowStatus.WAITING_VALIDATION);
    await m.engine.liberer({ escrowId: e.id, triggeredBy: EscrowTrigger.SYSTEM, releaseReason: 'auto' });
    expect(m.emit.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});

/* ============================================================
 * 6. BUGS CONNUS — à corriger (décision métier requise)
 *
 * test.failing : ces tests décrivent le comportement ATTENDU et échouent
 * aujourd'hui. Le jour où le bug est corrigé, Jest signalera qu'ils
 * passent : retirer alors `.failing`.
 * ============================================================ */

describe('Séquestre — BUGS CONNUS (remboursement partiel)', () => {

  test.failing(
    "remboursement partiel : l'argent total reste égal au montant payé (aujourd'hui : argent créé)",
    async () => {
      const m = monter();
      const e = await amenerA(m, EscrowStatus.DISPUTED);

      await m.engine.resoudreLitige({
        escrowId: e.id, disputeId: 'litige-1', decision: 'REMBOURSEMENT_PARTIEL',
        montantRembourse: 20_000, adminUserId: 'admin-1', note: 'article abîmé',
      });

      /* Le client reçoit 20 000 alors que les 115 000 restent en attente chez
       * les acteurs : 135 000 existent pour 115 000 payés. */
      expect(m.banque.total()).toBe(MONTANT);
    },
  );

  test.failing(
    "remboursement partiel : les vendeurs touchent le reste (aujourd'hui : bloqué à vie en attente)",
    async () => {
      const m = monter();
      const e = await amenerA(m, EscrowStatus.DISPUTED);

      await m.engine.resoudreLitige({
        escrowId: e.id, disputeId: 'litige-1', decision: 'REMBOURSEMENT_PARTIEL',
        montantRembourse: 20_000, adminUserId: 'admin-1', note: 'article abîmé',
      });

      const enAttente = PARTS.reduce((s, [, w]) => s + solde(m, w).pending, 0);
      expect(enAttente).toBe(0);
    },
  );

  test.failing(
    "décision RE_LIVRAISON : le client n'est pas remboursé (aujourd'hui : remboursé en TOTALITÉ)",
    async () => {
      const m = monter();
      const e = await amenerA(m, EscrowStatus.DISPUTED);

      await m.engine.resoudreLitige({
        escrowId: e.id, disputeId: 'litige-1', decision: 'RE_LIVRAISON', adminUserId: 'admin-1', note: 'renvoi du colis',
      });

      expect(solde(m, 'wallet-client').balance).toBe(0);
    },
  );
});
