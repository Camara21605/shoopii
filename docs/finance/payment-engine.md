# PaymentEngine

**Fichier** : `src/modules/payment-engine/payment.engine.ts`  
**Module** : `PaymentEngineModule`

---

## Responsabilités

- Initier des sessions de paiement auprès des providers externes (Orange Money, MTN, Wave, Djomy…)
- Traiter les webhooks de confirmation/rejet reçus des providers
- Coordonner avec EscrowEngine (séquestre) et CommissionEngine (calcul commissions)
- Gérer les remboursements via les providers
- Tracer toutes les sessions dans l'audit

---

## Providers supportés

| Provider | Fichier |
|---|---|
| Orange Money | `payment-provider.factory.ts` |
| MTN Mobile Money | `payment-provider.factory.ts` |
| Wave | `payment-provider.factory.ts` |
| Djomy | `payment-provider.factory.ts` |
| Moov Money | `payment-provider.factory.ts` |
| Virement bancaire | `payment-provider.factory.ts` |

Tous implémentent `IPaymentProvider` :

```typescript
interface IPaymentProvider {
  initierPaiement(ctx: PaymentContext): Promise<PaymentSession>;
  verifierStatut(sessionId: string): Promise<PaymentStatus>;
  initierRemboursement(ctx: RefundContext): Promise<RefundResult>;
}
```

Pour ajouter un nouveau provider → voir [guides/add-payment-provider.md](../guides/add-payment-provider.md).

---

## Flux principal

```
PaymentEngine.initierPaiement(ctx)
  │
  ├─ PaymentProviderConfigService.getConfig(provider)
  ├─ PaymentSessionManager.creerSession()
  ├─ IPaymentProvider.initierPaiement()
  ├─ PaymentAuditService.logInitiation()
  └─ EventBus.emit('payment.initiated')

PaymentEngine.traiterWebhook(provider, payload)
  │
  ├─ PaymentWebhookProcessor.valider(signature)
  ├─ PaymentSessionManager.mettreAJour(status)
  │
  ├─ Si CONFIRMED:
  │   ├─ EscrowEngine.recevoirFonds()
  │   ├─ CommissionEngine.calculer()
  │   └─ EventBus.emit('payment.confirmed')
  │
  └─ Si FAILED:
      ├─ EscrowEngine.marquerEchoue()
      └─ EventBus.emit('payment.failed')
```

---

## Services internes

| Service | Rôle |
|---|---|
| `PaymentSessionManager` | Création et mise à jour des sessions de paiement |
| `PaymentWebhookProcessor` | Validation signature + dispatching webhook |
| `PaymentProviderConfigService` | Lit la config provider (clés API, URLs) depuis DB |
| `PaymentRefundService` | Initie les remboursements via le provider |
| `PaymentAuditService` | Log d'audit (fire-and-forget) |
| `PaymentEventBus` | Wrapper EventEmitter2 |

---

## Événements émis

| Événement | Déclencheur |
|---|---|
| `payment.initiated` | Après initiation réussie auprès du provider |
| `payment.confirmed` | Webhook de confirmation reçu et validé |
| `payment.failed` | Webhook d'échec ou timeout |
| `payment.refund.initiated` | Remboursement initié |
| `payment.refund.confirmed` | Remboursement confirmé |
