# Architecture Globale — Shopi

## Vue d'ensemble

Shopi est une plateforme e-commerce **multi-acteurs** organisée autour d'un backend NestJS avec des moteurs financiers encapsulés (escrow, wallet, commissions) et un frontend React multi-dashboard.

---

## Diagramme de l'architecture globale

```mermaid
graph TB
    subgraph "Frontend — React 19 + Vite"
        FE_PUB["Pages publiques<br/>(home, catalogue, help, support)"]
        FE_DASH["Dashboards par rôle<br/>(client, company, delivery, admin…)"]
        FE_HTTP["apiFetch() — HTTP wrapper"]
    end

    subgraph "Backend — NestJS"
        GATEWAY["API Gateway<br/>ThrottlerGuard · CorrelationId · JwtAuthGuard"]
        
        subgraph "Modules fonctionnels"
            AUTH["AuthModule<br/>JWT + Refresh token"]
            COMMANDE["CommandeModule<br/>Cycle de vie commande"]
            WALLET["WalletModule<br/>API wallet (REST)"]
            NOTIF["NotificationsModule<br/>Push · Email · Socket"]
            SUPPORT["HelpModule · SupportModule"]
            MSG["MessagerieModule<br/>Conversations + contacts"]
        end

        subgraph "Moteurs financiers"
            WE["WalletEngine<br/>8 étapes · verrou pessimiste"]
            CE["CommissionEngine<br/>Calcul · Hiérarchie · Distribution"]
            EE["EscrowEngine<br/>Séquestre · États · Litiges"]
            PE["PaymentEngine<br/>Sessions · Webhooks · Providers"]
            RE["ResolutionEngine<br/>Disputes · Décisions"]
            SE["SettlementEngine<br/>Payout · Withdrawal"]
            FCE["FinancialConfigEngine<br/>Config live · Cache"]
            RPE["ReportingEngine<br/>KPI · Analytics · Export"]
            PERF["PerformanceEngine<br/>Profiler · Circuit Breaker · Cache"]
        end

        subgraph "Infrastructure"
            DB["PostgreSQL<br/>TypeORM · 60+ entités"]
            REDIS["Redis<br/>Cache · Queue · Sessions"]
            BULL["BullMQ<br/>Jobs asynchrones"]
            CLOUD["Cloudinary<br/>Upload fichiers"]
        end
    end

    FE_PUB --> FE_HTTP
    FE_DASH --> FE_HTTP
    FE_HTTP -->|"HTTPS REST"| GATEWAY
    GATEWAY --> AUTH
    GATEWAY --> COMMANDE
    GATEWAY --> WALLET
    GATEWAY --> NOTIF
    GATEWAY --> SUPPORT
    GATEWAY --> MSG
    COMMANDE --> WE
    COMMANDE --> CE
    COMMANDE --> EE
    PE --> WE
    PE --> EE
    EE --> WE
    RE --> EE
    SE --> WE
    FCE -->|"règles actives"| CE
    FCE -->|"règles actives"| PE
    WE --> DB
    EE --> DB
    PE --> DB
    PERF --> REDIS
    WE --> REDIS
```

---

## Découpage modulaire

### Couche 1 — Infrastructure

| Module | Rôle |
|---|---|
| `DatabaseModule` | Connexion PostgreSQL + TypeORM + migrations |
| `RedisModule` | Connexion Redis (ioredis) avec `lazyConnect: true` |
| `BullMQ` | Queue asynchrone pour jobs (notifications, settlements…) |
| `MailModule` | Envoi email via transport configurable |
| `UploadModule` | Upload Cloudinary via `memoryStorage` |

### Couche 2 — Modules fonctionnels

| Module | Rôle |
|---|---|
| `AuthModule` | Login, register, JWT access/refresh, 2FA codes |
| `CommandeModule` | Création, validation, suivi, annulation des commandes |
| `WalletModule` | API REST pour les opérations wallet (façade) |
| `PaiementModule` | Initiation et confirmation des paiements |
| `MessagerieModule` | Conversations, messages, permissions, contacts |
| `NotificationsModule` | Push, email, socket, préférences |
| `HelpModule` | Articles, FAQ, recherche |
| `SupportModule` | Tickets, agents, escalade |
| `GeoModule` | Référentiel géographique (pays → quartier) |
| `DashboardModule` | APIs dédiées aux tableaux de bord par rôle |

### Couche 3 — Moteurs financiers

Chaque moteur suit le même pattern :
- Un **Engine** (façade = point d'entrée unique)
- Des **Services** spécialisés (validator, calculator, distributor, audit, history…)
- Un **EventBus** (événements asynchrones inter-modules)
- Des **Types** centraux (interfaces, erreurs typées)

| Moteur | Fichier principal |
|---|---|
| WalletEngine | `wallet-engine/wallet.engine.ts` |
| CommissionEngine | `commission/commission.engine.ts` |
| EscrowEngine | `escrow-engine/escrow.engine.ts` |
| PaymentEngine | `payment-engine/payment.engine.ts` |
| ResolutionEngine | `resolution-engine/resolution.engine.ts` |
| SettlementEngine | `settlement-engine/settlement.engine.ts` |
| FinancialConfigEngine | `financial-config-engine/financial-config.engine.ts` |
| ReportingEngine | `reporting-engine/reporting.engine.ts` |
| PerformanceEngine | `performance-engine/performance.engine.ts` |

---

## Ordre de démarrage des modules (app.module.ts)

```
1. ConfigModule (global)
2. ThrottlerModule (rate limiting)
3. DatabaseModule, MailModule, AuthModule…
4. WalletEngineModule, EscrowEngineModule, PaymentEngineModule…
5. RedisModule → BullModule
6. SuivisModule, MessagerieModule… (consommateurs Redis)
7. NotificationsModule
8. PerformanceModule (après RedisModule)
9. HealthModule
```

> **Règle critique** : tout module injectant `@InjectRedis()` ou `@InjectQueue()` doit être déclaré **après** `RedisModule` et `BullModule`.

---

## Interactions Frontend ↔ Backend

```mermaid
sequenceDiagram
    participant FE as Frontend (React)
    participant API as Backend (NestJS)
    participant DB as PostgreSQL
    participant Redis

    FE->>API: POST /auth/login
    API->>DB: SELECT user WHERE email=…
    API-->>FE: { accessToken, refreshToken }

    FE->>API: POST /commandes (Bearer token)
    API->>API: JwtAuthGuard → RolesGuard
    API->>DB: INSERT commande
    API->>WalletEngine: executer(ESCROW_CREDIT)
    WalletEngine->>DB: SELECT wallet FOR UPDATE
    WalletEngine->>DB: INSERT wallet_transaction
    API-->>FE: { commandeId, statut: "EN_ATTENTE" }

    FE->>API: GET /notifications (SSE)
    API->>Redis: SUBSCRIBE notifications:userId
    Redis-->>API: event
    API-->>FE: data: { type, payload }
```

---

## Flux des événements

Tous les moteurs financiers émettent des événements via `EventEmitter2`.
`EventOrchestrationModule` centralise les subscribers cross-modules.

```mermaid
graph LR
    CE["CommissionEngine"] -->|commission.calculated| EO["EventOrchestration"]
    WE["WalletEngine"] -->|wallet.operation.success| EO
    EE["EscrowEngine"] -->|escrow.released| EO
    PE["PaymentEngine"] -->|payment.confirmed| EO
    EO -->|déclenche| CE
    EO -->|déclenche| SE["SettlementEngine"]
    EO -->|déclenche| NOTIF["NotificationsModule"]
```

Voir [flows.md](./flows.md) pour les diagrammes de flux complets.
