# ADR-005 — EventEmitter2 pour la communication inter-modules

**Statut** : Accepté  
**Date** : 2026

---

## Contexte

Les moteurs financiers ont besoin de communiquer entre eux sans couplage direct. Par exemple, quand un paiement est confirmé, plusieurs actions doivent se produire : mise à jour de l'escrow, calcul des commissions, envoi de notifications, mise à jour des rapports.

## Options envisagées

### 1. Appels directs entre services
`PaymentEngine` injecte `EscrowEngine`, `CommissionEngine`, `NotificationsService`…

**Inconvénients** : Couplage fort, difficile à étendre, risque de dépendances circulaires

### 2. Message broker externe (RabbitMQ, Kafka)
**Inconvénients** : Infrastructure supplémentaire, latence réseau, overkill pour l'échelle actuelle

### 3. EventEmitter2 en mémoire (choisi)
NestJS `EventEmitter2` avec événements typés.

## Décision

**EventEmitter2** (in-process) avec des **EventBus** par moteur.

Chaque moteur expose son propre `XxxEventBus` qui wrape `EventEmitter2`.

## Pattern

```typescript
// Émission (après l'opération, jamais avant)
this.eventBus.emit(WALLET_EVENTS.SUCCESS, new WalletOperationSuccessEvent(...));

// Écoute (dans un subscriber ou un autre module)
@OnEvent(WALLET_EVENTS.SUCCESS)
async handleWalletSuccess(event: WalletOperationSuccessEvent) {
  await this.notificationsService.notifier(...);
}
```

## Justification

- Pas de couplage entre émetteur et consommateurs
- Zéro infrastructure supplémentaire
- Les événements sont émis **après** l'opération (jamais avant, jamais à la place de)
- Audit et notifications ne bloquent jamais le chemin critique (fire-and-forget)
- `EventOrchestrationModule` centralise les subscribers cross-modules

## Conséquences

✅ Zéro couplage entre les moteurs  
✅ Ajouter un nouveau consommateur = ajouter `@OnEvent()` sans toucher à l'émetteur  
✅ Audit fire-and-forget sans impacter la performance  
⚠️ Événements en mémoire → perdus si le serveur crashe (acceptable pour l'audit, moins pour les settlements — BullMQ utilisé pour les jobs critiques)  
⚠️ Pas de retry automatique sur les handlers d'événements
