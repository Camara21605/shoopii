# Guide — Ajouter un provider de paiement

---

## 1. Implémenter l'interface `IPaymentProvider`

```typescript
/* ============================================================
 * FICHIER : src/modules/payment-engine/providers/mon-provider.provider.ts
 * ============================================================ */

import { IPaymentProvider } from './payment-provider.interface';

export class MonProviderPaymentProvider implements IPaymentProvider {

  async initierPaiement(ctx: PaymentContext): Promise<PaymentSession> {
    // Appel à l'API du provider
    // Retourner la session créée
  }

  async verifierStatut(sessionId: string): Promise<PaymentStatus> {
    // Interroger le statut de la session
  }

  async initierRemboursement(ctx: RefundContext): Promise<RefundResult> {
    // Initier le remboursement
  }
}
```

---

## 2. Implémenter l'interface `IPayoutProvider`

```typescript
/* ============================================================
 * FICHIER : src/modules/settlement-engine/providers/mon-provider-payout.provider.ts
 * ============================================================ */

import { IPayoutProvider } from './payout-provider.interface';

export class MonProviderPayoutProvider implements IPayoutProvider {

  async initierVirement(ctx: PayoutContext): Promise<PayoutResult> {
    // Initier le virement via l'API du provider
  }

  async verifierStatut(payoutId: string): Promise<PayoutStatus> {
    // Vérifier le statut du virement
  }
}
```

---

## 3. Ajouter dans PaymentProviderFactory

```typescript
// src/modules/payment-engine/providers/payment-provider.factory.ts

switch (provider) {
  case PaymentProvider.ORANGE_MONEY: return new OrangeMoneyProvider(config);
  case PaymentProvider.MTN: return new MtnProvider(config);
  // ... providers existants ...
  case PaymentProvider.MON_PROVIDER: return new MonProviderPaymentProvider(config);
  default: throw new Error(`Provider inconnu: ${provider}`);
}
```

---

## 4. Ajouter dans PayoutProviderFactory

```typescript
// src/modules/settlement-engine/providers/payout-provider.factory.ts

case PayoutMethod.MON_PROVIDER: return new MonProviderPayoutProvider(config);
```

---

## 5. Ajouter l'enum du provider

```typescript
// src/common/enums/ ou dans les types du module
export enum PaymentProvider {
  ORANGE_MONEY = 'ORANGE_MONEY',
  MTN = 'MTN',
  WAVE = 'WAVE',
  DJOMY = 'DJOMY',
  MOOV_MONEY = 'MOOV_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  MON_PROVIDER = 'MON_PROVIDER',  // ← Ajouter
}
```

---

## 6. Ajouter les variables d'environnement

```env
# .env
MON_PROVIDER_API_KEY=
MON_PROVIDER_API_SECRET=
MON_PROVIDER_WEBHOOK_SECRET=
MON_PROVIDER_BASE_URL=https://api.mon-provider.com
```

---

## 7. Valider la signature du webhook

```typescript
// Dans PaymentWebhookProcessor.valider()
case 'mon-provider':
  return this.validerSignatureMonProvider(payload, signature, secret);
```

Toujours valider la signature HMAC avant de traiter le webhook.

---

## 8. Ajouter la migration si nécessaire

Si vous ajoutez des colonnes dans `payment_session` ou `payout` pour le provider.

---

## Checklist

- [ ] `IPaymentProvider` implémenté
- [ ] `IPayoutProvider` implémenté
- [ ] Enum mis à jour
- [ ] Factories mises à jour (payment + payout)
- [ ] Variables d'environnement documentées dans `docs/guides/environment.md`
- [ ] Validation signature webhook
- [ ] Tests écrits (mock du provider externe)
- [ ] Config provider stockée en DB (pas en dur dans le code)
