# Flux Métier et Financiers — Shopi

## Flux d'une commande complète

```mermaid
stateDiagram-v2
    [*] --> EN_ATTENTE_PAIEMENT : Client crée la commande
    EN_ATTENTE_PAIEMENT --> PAIEMENT_EN_COURS : Paiement initié
    PAIEMENT_EN_COURS --> PAYEE : Webhook confirmation provider
    PAYEE --> EN_PREPARATION : Entreprise accepte
    EN_PREPARATION --> EN_LIVRAISON : Livreur récupère le colis
    EN_LIVRAISON --> LIVREE : Livreur confirme
    LIVREE --> VALIDEE : Client valide (ou timeout 48h)
    VALIDEE --> [*] : EscrowEngine libère les fonds

    PAIEMENT_EN_COURS --> ECHOUEE : Timeout ou échec provider
    EN_PREPARATION --> ANNULEE : Entreprise refuse
    EN_LIVRAISON --> LITIGE : Client ouvre un litige
    LITIGE --> RESOLUE : Admin tranche
    RESOLUE --> [*]
```

---

## Flux financier d'une commande

```mermaid
sequenceDiagram
    participant C as Client Wallet
    participant E as Escrow
    participant S as Shopi Wallet
    participant ENT as Entreprise Wallet
    participant L as Livreur Wallet

    C->>E: ESCROW_CREDIT (montant total)
    Note over E: Statut: CREATED → FUNDS_RECEIVED

    E->>E: LOCKED (fonds bloqués)
    Note over E: Statut: LOCKED → WAITING_VALIDATION

    alt Livraison validée (ou timeout)
        E->>S: Commission Shopi
        E->>ENT: Part entreprise
        E->>L: Part livreur
        Note over E: Statut: RELEASED
    else Litige → remboursement total
        E->>C: Remboursement
        Note over E: Statut: REFUND_PENDING → REFUNDED
    else Litige → remboursement partiel
        E->>C: Part remboursée
        E->>ENT: Part entreprise (réduite)
        Note over E: Statut: RESOLVED
    end
```

---

## Flux de calcul des commissions

```mermaid
flowchart TD
    START([CommissionEngine.calculer]) --> CONFIG[getActiveRule → DB]
    CONFIG --> VALIDATE[CommissionValidatorService.validerTout]
    VALIDATE --> HIERARCHY[CommissionHierarchyService.resolveAll<br/>entWallet, livreurWallet, partnerWallet, correspondantWallet]
    HIERARCHY --> CALC[CommissionCalculatorService.calculer<br/>pure math · floor · ±1 GNF]
    CALC --> DISTRIB[CommissionDistributorService.preparer<br/>instructions de virement]
    DISTRIB --> AUDIT[CommissionAuditService.logCalculReussi<br/>fire-and-forget]
    AUDIT --> EVENT[EventEmitter2.emit commission.calculated]
    EVENT --> END([CommissionResult])

    VALIDATE -->|erreur| ERR[CommissionErreur]
    CALC -->|erreur| ERR
    ERR --> AUDIT_ERR[CommissionAuditService.logErreur]
    AUDIT_ERR --> RETHROW([re-throw CommissionErreur])
```

---

## Flux Wallet Engine (pipeline 8 étapes)

```mermaid
flowchart TD
    CALL([WalletEngine.executer]) --> IDEM{Clé idempotence<br/>déjà en DB?}
    IDEM -->|Oui| DOUBLON([throw WalletErreur DOUBLON_IDEMPOTENCY])
    IDEM -->|Non| LOCK[WalletLockService.runWithLockedWallet<br/>SELECT FOR UPDATE]
    LOCK --> VALID[WalletValidatorService.validerTout<br/>statut · montant · solde · limite]
    VALID -->|invalide| ERR_VALID([throw WalletErreur])
    VALID -->|ok| DISPATCH[WalletMovementService<br/>crediter · debiter · bloquer…]
    DISPATCH --> AUDIT[WalletAuditService.logOperationReussie<br/>fire-and-forget]
    AUDIT --> EVENT[WalletEventBus.emit<br/>wallet.operation.success]
    EVENT --> RESULT([WalletOperationResult])
    DISPATCH -->|erreur| ERR[WalletAuditService.logOperationEchouee]
    ERR --> RETHROW([re-throw WalletErreur])
```

---

## Flux Escrow — transitions d'état

```mermaid
stateDiagram-v2
    [*] --> CREATED : EscrowEngine.creer()
    CREATED --> FUNDS_RECEIVED : recevoirFonds()
    FUNDS_RECEIVED --> LOCKED : verrouillerFonds()
    LOCKED --> WAITING_VALIDATION : attendreValidation()
    WAITING_VALIDATION --> DISPUTED : ouvrirLitige()
    WAITING_VALIDATION --> RELEASED : liberer()
    DISPUTED --> RESOLVED : resoudreLitige(REJET)
    DISPUTED --> REFUND_PENDING : resoudreLitige(REMBOURSEMENT_TOTAL)
    REFUND_PENDING --> REFUNDED : rembourser()
    RESOLVED --> [*]
    REFUNDED --> [*]
    WAITING_VALIDATION --> FAILED : marquerEchoue()
    WAITING_VALIDATION --> EXPIRED : marquerExpire()
    FAILED --> [*]
    EXPIRED --> [*]
```

---

## Flux de retrait (Settlement)

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant SE as SettlementEngine
    participant WE as WalletEngine
    participant PP as PayoutProvider

    U->>SE: demanderRetrait(amount, method)
    SE->>SE: EligibilityValidator.valider()
    SE->>WE: executer(WITHDRAWAL_PENDING)
    Note over WE: Solde disponible → pending
    SE->>PP: initierPaiement(amount, recipient)
    PP-->>SE: { transactionId, status }
    SE->>WE: executer(WITHDRAWAL_CONFIRMED / WITHDRAWAL_FAILED)
    SE->>SE: logAudit + emitEvent
```

---

## Flux d'événements inter-moteurs

```mermaid
graph LR
    subgraph "Émetteurs"
        WE["WalletEngine"]
        CE["CommissionEngine"]
        EE["EscrowEngine"]
        PE["PaymentEngine"]
        RE["ResolutionEngine"]
        SE["SettlementEngine"]
    end

    subgraph "EventOrchestrationEngine"
        direction TB
        W_SUB["wallet.subscriber"]
    end

    subgraph "Consommateurs"
        NOTIF["NotificationsModule"]
        SE2["SettlementEngine"]
        CE2["CommissionEngine"]
        AUDIT["AuditLog"]
    end

    WE -->|wallet.operation.success| W_SUB
    CE -->|commission.calculated| W_SUB
    EE -->|escrow.released| W_SUB
    PE -->|payment.confirmed| W_SUB
    RE -->|resolution.resolved| W_SUB

    W_SUB --> NOTIF
    W_SUB --> SE2
    W_SUB --> CE2
    W_SUB --> AUDIT
```
