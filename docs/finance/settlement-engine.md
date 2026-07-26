# SettlementEngine

**Fichier** : `src/modules/settlement-engine/settlement.engine.ts`  
**Module** : `SettlementEngineModule`

---

## Responsabilités

- Gérer les demandes de retrait des acteurs (entreprises, livreurs, partenaires)
- Vérifier l'éligibilité au retrait (solde min, délai, KYC…)
- Déclencher les virements via les providers de payout
- Gérer le scheduler de settlements automatiques (batch hebdomadaire)
- Tracer toutes les opérations de payout

---

## Providers de payout

| Provider | Fichier |
|---|---|
| Orange Money | `providers/orange-money-payout.provider.ts` |
| MTN Mobile Money | `providers/mtn-payout.provider.ts` |
| Wave | `providers/wave-payout.provider.ts` |
| Djomy | `providers/djomy-payout.provider.ts` |
| Moov Money | `providers/moov-money-payout.provider.ts` |
| Virement bancaire | `providers/bank-transfer-payout.provider.ts` |

Tous implémentent `IPayoutProvider` :

```typescript
interface IPayoutProvider {
  initierVirement(ctx: PayoutContext): Promise<PayoutResult>;
  verifierStatut(payoutId: string): Promise<PayoutStatus>;
}
```

---

## Flux de retrait

```
SettlementEngine.demanderRetrait(ctx)
  │
  ├─ EligibilityValidator.valider()
  │   → Solde ≥ minimum, délai de blocage respecté, KYC validé
  │
  ├─ WalletEngine.executer(WITHDRAWAL_PENDING)
  │   → balance → pendingBalance
  │
  ├─ PayoutProviderFactory.getProvider(method)
  ├─ IPayoutProvider.initierVirement()
  │
  ├─ Si succès:
  │   └─ WalletEngine.executer(WITHDRAWAL_CONFIRMED)
  │
  └─ Si échec:
      └─ WalletEngine.executer(WITHDRAWAL_FAILED)
          → pendingBalance → balance (reversal)
```

---

## Settlement Scheduler

`SettlementSchedulerService` exécute automatiquement les settlements programmés via BullMQ :

- **Fréquence** : configurable via `FinancialConfigEngine`
- **Batch** : traite tous les wallets éligibles dont le solde dépasse le seuil
- **Priorité** : LIFO par montant (plus gros retrait en premier)

---

## Services internes

| Service | Rôle |
|---|---|
| `EligibilityValidator` | Vérifie si le retrait est autorisé |
| `PayoutManager` | Orchestre l'exécution du payout |
| `WithdrawalManager` | Gère le cycle d'une demande de retrait |
| `WithdrawalValidation` | Valide le contexte de retrait |
| `SettlementScheduler` | Batch automatique via BullMQ |
| `SettlementAudit` | Log d'audit (fire-and-forget) |
| `SettlementHistory` | Lecture historique paginé |

---

## Événements émis

| Événement | Déclencheur |
|---|---|
| `settlement.withdrawal.requested` | Demande de retrait créée |
| `settlement.withdrawal.processing` | Virement en cours |
| `settlement.withdrawal.completed` | Virement confirmé |
| `settlement.withdrawal.failed` | Virement échoué |
| `settlement.batch.completed` | Fin d'un batch automatique |
