# WalletEngine

**Fichier** : `src/modules/wallet-engine/wallet.engine.ts`  
**Module** : `WalletEngineModule`

---

## Responsabilités

Le WalletEngine est le **point d'entrée unique** pour tout mouvement financier sur la plateforme. Aucun service externe ne doit modifier directement une entité `Wallet` ou `WalletTransaction`.

- Exécuter des opérations atomiques sur un wallet (crédit, débit, blocage…)
- Effectuer des transferts internes entre deux wallets
- Garantir l'idempotence (anti-doublon via clé unique)
- Acquérir un verrou pessimiste (`SELECT FOR UPDATE`) avant toute modification
- Tracer toutes les opérations dans l'audit log
- Émettre des événements asynchrones après chaque opération

---

## Pipeline en 8 étapes

```
WalletEngine.executer(ctx)
  1. txRepo.findOne({ idempotencyKey })
     → Doublon ? throw WalletErreur(DOUBLON_IDEMPOTENCY)
  2. WalletLockService.runWithLockedWallet(walletId, fn)
     → SELECT * FROM wallet WHERE id=? FOR UPDATE
  3. WalletValidatorService.validerTout(wallet, ctx)
     → statut ACTIVE, montant > 0, solde suffisant, limites
  4. WalletMovementService[méthode](wallet, ctx, qr)
     → crediter() | debiter() | bloquer() | débloquer()…
  5. WalletAuditService.logOperationReussie()    [fire-and-forget]
  6. WalletEventBus.emit(WALLET_EVENTS.SUCCESS)  [fire-and-forget]
  7. return WalletOperationResult
```

Pour les transferts (`WalletEngine.transferer()`) :
```
  2b. WalletLockService.runWithLockedDualWallets(srcId, tgtId, fn)
  4b. debiter(src) + crediter(tgt) dans le même QueryRunner
```

---

## Types d'opérations (`WalletOperationType`)

| Type | Direction | Solde impacté |
|---|---|---|
| `DEPOSIT` | Crédit | `balance` |
| `WITHDRAWAL_PENDING` | Débit | `balance` → `pendingBalance` |
| `WITHDRAWAL_CONFIRMED` | Débit définitif | `pendingBalance` |
| `WITHDRAWAL_FAILED` | Reversal | `pendingBalance` → `balance` |
| `COMMISSION_CREDIT` | Crédit | `balance` |
| `ESCROW_CREDIT` | Crédit escrow | `escrowBalance` |
| `ESCROW_DEBIT` | Débit escrow | `escrowBalance` |
| `TRANSFER_IN` | Crédit | `balance` |
| `TRANSFER_OUT` | Débit | `balance` |
| `ADJUSTMENT` | Crédit ou Débit | configurable |
| `CORRECTION` | Crédit ou Débit | configurable |
| `BLOCK` | Blocage | `frozenBalance` |
| `UNBLOCK` | Déblocage | `frozenBalance` → `balance` |

---

## Types de soldes (`BalanceType`)

| Valeur | Description |
|---|---|
| `BALANCE` | Solde disponible |
| `PENDING_BALANCE` | En attente de confirmation |
| `ESCROW_BALANCE` | Séquestré |
| `FROZEN_BALANCE` | Bloqué (litige, gel admin) |
| `BONUS_BALANCE` | Bonus promotionnels |

---

## Erreurs (`WalletErreurType`)

| Code | Cause |
|---|---|
| `WALLET_INTROUVABLE` | walletId inconnu en DB |
| `WALLET_INACTIF` | statut != ACTIVE |
| `WALLET_GELE` | statut FROZEN |
| `WALLET_FERME` | statut CLOSED |
| `MONTANT_INVALIDE` | montant ≤ 0 ou NaN |
| `SOLDE_INSUFFISANT` | balance < montant |
| `SOLDE_SOURCE_INSUFFISANT` | pendingBalance < montant |
| `LIMITE_RETRAIT_ATTEINTE` | dailyWithdrawLimit dépassée |
| `DEVISE_INCOMPATIBLE` | wallets sur devises différentes |
| `OPERATION_NON_AUTORISEE` | transfert même wallet |
| `PARAMETRE_MANQUANT` | note manquante pour ADJUSTMENT |
| `DOUBLON_IDEMPOTENCY` | clé déjà utilisée |
| `ERREUR_INTERNE` | erreur système inconnue |

---

## Événements émis

| Événement | Classe | Déclencheur |
|---|---|---|
| `wallet.operation.success` | `WalletOperationSuccessEvent` | Après toute opération réussie |
| `wallet.operation.failed` | `WalletOperationFailedEvent` | Après une erreur métier |
| `escrow.credited` | `EscrowCreditedEvent` | Après ESCROW_CREDIT |
| `escrow.released` | `EscrowReleasedEvent` | Après ESCROW_DEBIT (libération) |
| `escrow.cancelled` | `EscrowCancelledEvent` | Après annulation escrow |
| `withdrawal.initiated` | `WithdrawalInitiatedEvent` | WITHDRAWAL_PENDING |
| `withdrawal.confirmed` | `WithdrawalConfirmedEvent` | WITHDRAWAL_CONFIRMED |
| `withdrawal.failed` | `WithdrawalFailedEvent` | WITHDRAWAL_FAILED |

---

## Services internes

| Service | Rôle |
|---|---|
| `WalletLockService` | Verrou pessimiste (`SELECT FOR UPDATE`) |
| `WalletValidatorService` | Validation des préconditions (8 méthodes) |
| `WalletMovementService` | Exécution des opérations comptables |
| `WalletLedgerService` | Écriture dans le grand livre (`WalletLedgerEntry`) |
| `WalletAuditService` | Log d'audit dans `AuditLog` |
| `WalletHistoryService` | Lecture de l'historique paginé |
| `WalletEventBus` | Wrapper `EventEmitter2` |

---

## Dépendances externes

- `Repository<Wallet>` (TypeORM)
- `Repository<WalletTransaction>` (TypeORM)
- `DataSource` (pour `QueryRunner`)
- Aucun autre moteur financier (WalletEngine est la couche la plus basse)

---

## Exemple d'utilisation

```typescript
// Dépôt de 50 000 GNF
const result = await walletEngine.executer({
  walletId: 'wallet-uuid',
  amount: 50_000,
  operationType: WalletOperationType.DEPOSIT,
  balanceType: BalanceType.BALANCE,
  idempotencyKey: 'deposit-order-abc123',
  description: 'Rechargement compte client',
});

// Transfert interne
const transfer = await walletEngine.transferer({
  sourceWalletId: 'wallet-src',
  targetWalletId: 'wallet-tgt',
  amount: 10_000,
  balanceType: BalanceType.BALANCE,
  idempotencyKey: 'transfer-uuid',
});
```
