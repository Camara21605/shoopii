# Shopi — Documentation complète du projet

> Ce fichier explique **chaque dossier, chaque fichier et chaque ligne de code important** du projet Shopi.
> Écrit pour qu'un débutant puisse comprendre sans aide extérieure.

---

## C'est quoi Shopi ?

Shopi est un **marché en ligne africain** (Guinée, monnaie GNF).

Des boutiques vendent des produits. Des clients achètent. Des livreurs livrent. Des correspondants gèrent des dépôts. Tout le monde a un portefeuille électronique intégré.

---

## Structure générale du projet

```
shoopii/                        ← Dossier racine
│
├── shopi-backend/              ← Le serveur (cerveau caché)
├── shopi-frontend/             ← L'application web (ce que l'on voit)
├── docs/                       ← Documentation technique
└── README.md                   ← CE FICHIER
```

---

---

# PARTIE 1 — LE BACKEND

> Le backend est le **serveur**. Il reçoit les requêtes du navigateur, accède à la base de données, calcule les commissions, gère les paiements, etc.
>
> **Technologie** : NestJS 11 (TypeScript) + PostgreSQL + Redis

---

## Structure complète du backend

```
shopi-backend/
│
├── src/                        ← Tout le code source
│   ├── main.ts                 ← Point d'entrée (démarre le serveur)
│   ├── app.module.ts           ← Module racine (assembles tous les autres)
│   ├── app.controller.ts       ← Controller de base (route /)
│   ├── app.service.ts          ← Service de base
│   │
│   ├── common/                 ← Outils partagés par tous les modules
│   ├── config/                 ← Fichiers de configuration
│   ├── database/               ← Base de données (tables, migrations)
│   ├── jobs/                   ← Tâches automatiques planifiées
│   ├── modules/                ← Les 36 modules métier
│   ├── seed/                   ← Données initiales à insérer en DB
│   └── test/                   ← Helpers pour les tests
│
├── scripts/                    ← Scripts shell (backup, restore, health)
├── test/                       ← Tests end-to-end
└── package.json                ← Dépendances npm
```

---

## `main.ts` — Point de départ du serveur

C'est le fichier qui **démarre** tout. Quand on lance `npm run start`, Node.js lit ce fichier en premier.

```
main.ts fait 5 choses :
1. Force IPv4 (compatibilité Render.com)
2. Crée l'application NestJS
3. Active la validation automatique des formulaires
4. Configure les WebSockets (chat temps réel)
5. Ouvre le serveur sur un port (3000 en prod, 3001 en dev)
```

**Analogie** : C'est comme l'interrupteur principal d'un bâtiment. Tu l'allumes, tout s'allume.

---

## `app.module.ts` �� L'assembleur

C'est le fichier qui **importe tous les autres modules** et les connecte entre eux. Sans lui, les modules existent mais ne sont pas branchés ensemble.

Il configure aussi :
- **Redis** (mémoire rapide) avec reconnexion automatique
- **BullMQ** (files de travaux) pour les emails et notifications
- **Rate limiting** (max 60 requêtes/minute par IP)
- **CorrelationIdMiddleware** sur toutes les routes

**Analogie** : C'est le tableau de distribution électrique. Chaque disjoncteur = un module.

---

## Dossier `common/` — Les outils de base

> Tout ce qui est dans `common/` est utilisé par **TOUS** les autres modules.

```
common/
├── decorators/
│   ├── public.decorator.ts     ← @Public() : route accessible sans connexion
│   └── roles.decorator.ts      ← @Roles() : limite aux rôles · @CurrentUser() : récupère le user
│
├── enums/
│   └── user-role.enum.ts       ← Les 7 rôles : super_admin, admin, company, delivery, partner, correspondent, client
│
├── exceptions/
│   ├── help-center.exceptions.ts ← Erreurs du Centre d'aide (9 types)
│   └── support.exceptions.ts     ← Erreurs du Support client (12 types)
│
├── guards/
│   ├── auth.guard.ts           ← JwtAuthGuard : vérifie le token JWT sur chaque requête
│   ├── optional-jwt.guard.ts   ← Essaie le JWT mais laisse passer même si absent
│   └── roles.guard.ts          ← RolesGuard : vérifie que le rôle correspond
│
├── health/
│   ├── health.controller.ts    ← GET /health → {status: "ok", timestamp, environment, version}
│   └── health.module.ts        ← Module du health check
│
└── middleware/
    └── correlation-id.middleware.ts ← Attache un identifiant unique à chaque requête HTTP
```

### Qu'est-ce qu'un Guard ?

Un guard c'est un **videur de boîte de nuit**. Avant d'entrer (accéder à une route), il vérifie ton identité.

- `JwtAuthGuard` : "T'as ton token JWT ? Non ? Dehors (401)."
- `RolesGuard` : "T'as le bon badge (rôle) ? Non ? Interdit (403)."
- `OptionalJwtAuthGuard` : "T'as un token ? Tant mieux. T'en as pas ? OK entre quand même."

### Qu'est-ce qu'un Décorateur ?

Un décorateur c'est un **post-it** qu'on colle sur une fonction pour lui donner une instruction supplémentaire.

```typescript
@Get('catalogue')
@Public()                   // ← post-it "cette route est publique"
findAll() { ... }
```

### Qu'est-ce qu'une Exception ?

Au lieu de renvoyer une erreur générique "500 Internal Server Error", on renvoie un message clair :

```json
{ "message": "Ticket introuvable ou accès non autorisé.", "errorCode": "TICKET_NOT_FOUND" }
```

Le `errorCode` permet aux applications clientes de traduire le message dans la langue de l'utilisateur.

---

## Dossier `config/` — Les réglages

```
config/
├── cloudinary.config.ts  ← Config Cloudinary (stockage des images)
├── database.config.ts    ← Config PostgreSQL (hôte, port, nom de la DB)
├── env.config.ts         ← Valide les variables d'environnement au démarrage
├── jwt.config.ts         ← Config JWT (secret, durée de vie des tokens)
└── redis.config.ts       ← Config Redis (hôte, port, mot de passe)
```

Ces fichiers lisent les **variables d'environnement** (fichier `.env`). Jamais de mot de passe écrit en dur dans le code.

**Analogie** : C'est comme les "paramètres" de ton téléphone. Le code est le même pour tout le monde, mais les réglages changent d'une installation à l'autre.

---

## Dossier `database/` — La base de données

```
database/
├── database.module.ts           ← Connecte TypeORM à PostgreSQL
├── desable-fk.subscriber.ts     ← Désactive temporairement les contraintes FK (pour les tests)
│
├── entities/                    ← Les tables de la base de données
│   ├── user.entity.ts           ← Table "user" (tous les comptes)
│   ├── wallet.entity.ts         ← Table "wallet" (portefeuilles)
│   ├── wallet-transaction.entity.ts ← Table "wallet_transaction" (mouvements)
│   ├── wallet-ledger-entry.entity.ts ← Table "wallet_ledger_entry" (comptabilité)
│   ├── audit-log.entity.ts      ← Table "audit_log" (historique des actions)
│   ├── platform-settings.entity.ts ← Table "platform_settings" (config globale)
│   ├── panier-item.entity.ts    ← Table "panier_item" (articles dans le panier)
│   ├── report.entity.ts         ← Table "report" (signalements)
│   ├── localisation.entity.ts   ← Table "localisation" (adresses)
│   ├── code-creation.entity.ts  ← Table "code_creation" (codes d'invitation)
│   ├── appearance-preference.entity.ts ← Table "appearance_preference" (thème visuel)
│   │
│   ├── commande/                ← Tables des commandes
│   │   ├── commande.entity.ts        ← Commande principale
│   │   ├── commande-item.entity.ts   ← Ligne d'article dans une commande
│   │   └── commande-code.entity.ts   ← Codes de validation de commande
│   │
│   ├── paiement/                ← Tables financières
│   │   ├── escrow.entity.ts           ← Séquestre (argent bloqué pendant livraison)
│   │   ├── escrow-history.entity.ts   ← Historique du séquestre
│   │   ├── paiement-session.entity.ts ← Session de paiement Orange Money / MTN
│   │   ├── paiement-distribution.entity.ts ← Répartition vendeur/livreur/Shopi
│   │   ├── commission-rule.entity.ts  ← Règles de commission
│   │   ├── retrait.entity.ts          ← Demandes de retrait d'argent
│   │   ├── settlement-batch.entity.ts ← Lots de virements
│   │   ├── dispute.entity.ts          ← Litiges (client vs vendeur)
│   │   ├── dispute-evidence.entity.ts ← Preuves de litige
│   │   ├── dispute-history.entity.ts  ← Historique des litiges
│   │   ├── webhook-event.entity.ts    ← Événements reçus des providers de paiement
│   │   ├── provider-config.entity.ts  ← Config des providers de paiement
│   │   ├── financial-audit-log.entity.ts ← Log d'audit financier
│   │   └── configuration-snapshot.entity.ts ← Snapshot de config financière
│   │
│   ├── profiles/                ← Un profil par type d'utilisateur
│   │   ├── admin-profile.entity.ts
│   │   ├── client-profile.entity.ts
│   │   ├── entreprise-profile.entity.ts
│   │   ├── livreur-profile.entity.ts
│   │   ├── correspondant-profile.entity.ts
│   │   └── partenaire-profile.entity.ts
│   │
│   ├── entreprise.table/        ← Tables du catalogue
│   │   ├── product.entity.ts
│   │   ├── product-media.entity.ts
│   │   ├── product-variant.entity.ts
│   │   ├── product-spec.entity.ts
│   │   ├── product-story.entity.ts
│   │   ├── product-wholesale-tier.entity.ts
│   │   ├── product-like.entity.ts
│   │   ├── promotion.entity.ts
│   │   ├── promotion-product.entity.ts
│   │   ├── promotion-usage.entity.ts
│   │   ├── category.entity.ts
│   │   ├── sub-category.entity.ts
│   │   ├── company-type.entity.ts
│   │   ├── company-avis.entity.ts
│   │   └── company-horaire.entity.ts
│   │
│   ├── messaging/               ← Tables du chat
│   │   ├── conversation.entity.ts
│   │   ├── message.entity.ts
│   │   ├── message-read-receipt.entity.ts
│   │   ├── conversation-permission.entity.ts
│   │   └── messaging-audit-log.entity.ts
│   │
│   ├── notification/            ← Tables des notifications
│   │   ├── notification.entitiy.ts
│   │   ├── notification-preference.entity.ts
│   │   └── notification-delivery-log.entity.ts
│   │
│   ├── geo/                     ← Découpage géographique de la Guinée
│   │   ├── geo-pays.entity.ts
│   │   ├── geo-region.entity.ts
│   │   ├── geo-prefecture.entity.ts
│   │   ├── geo-commune.entity.ts
│   │   ├── geo-quartier.entity.ts
│   │   ├── geo-zone.entity.ts
│   │   └── geo-base.entity.ts
│   │
│   ├── location/                ← Géolocalisation en temps réel
│   │   ├── company-branch.entity.ts
│   │   └── location-history.entity.ts
│   │
│   ├── follow/                  ← Abonnements entre utilisateurs
│   │   ├── follow.entity.ts
│   │   ├── follow-request.entity.ts
│   │   └── follow-block.entity.ts
│   │
│   ├── contacts/                ← Contacts synchronisés (type WhatsApp)
│   │   ├── user-contact.entity.ts
│   │   └── contact-sync-session.entity.ts
│   │
│   ├── delivery-group/          ← Groupes de livraison
│   │   ├── delivery-group.entity.ts
│   │   ├── delivery-group-member.entity.ts
│   │   └── group-message.entity.ts
│   │
│   ├── help/                    ← Centre d'aide
│   │   ├── help-article.entity.ts
│   │   ├── help-category.entity.ts
│   │   ├── help-faq-item.entity.ts
│   │   └── help-search-query.entity.ts
│   │
│   ├── support/                 ← Tickets support
│   │   ├── support-ticket.entity.ts
│   │   ├── support-message.entity.ts
│   │   └── attachment.entity.ts
│   │
│   ├── returns/                 ← Retours et SAV
│   │   ├── return-request.entity.ts
│   │   ├── return-evidence.entity.ts
│   │   ├── return-history.entity.ts
│   │   ├── sav-ticket.entity.ts
│   │   └── sav-message.entity.ts
│   │
│   ├── security/                ← Sécurité et métriques
│   │   ├── security-event-log.entity.ts
│   │   ├── platform-incident.entity.ts
│   │   └── system-metric.entity.ts
│   │
│   ├── contact/                 ← Messages de contact public
│   │   └── contact-message.entity.ts
│   │
│   └── livreur.table/
│       └���─ livreur-horaire.entity.ts
│
├── migrations/                  ← Modifications de la structure DB dans le temps
│   ├── 1700000000000-add-client-settings-fields.ts
│   ├── 1700000000001-add-follow-isSubscribed.ts
│   ├── 1721000000000-paiement-system-complete.ts
│   ├── 1721000000001-commission-enum-extension.ts
│   ├── 1721000000002-wallet-engine-extension.ts
│   ├── 1721000000003-escrow-engine.ts
│   ├── 1721000000004-payment-engine.ts
│   ├── 1721000000005-resolution-engine.ts
│   ├── 1721000000006-settlement-engine.ts
│   ├── 1721000000007-financial-config-engine.ts
│   ├── 1721000000008-reporting-engine.ts
│   └── 1721100000000-performance-indexes.ts
│
└── transformers/
    └── column-numeric.transformer.ts  ← Convertit les DECIMAL en number JS (pas de string)
```

### Qu'est-ce qu'une Entity ?

Une Entity = une **table** dans PostgreSQL.

```typescript
// Exemple simplifié de wallet.entity.ts
@Entity('wallet')
export class Wallet {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('decimal') balance: number;        // Solde disponible
  @Column('decimal') escrow_balance: number; // Argent bloqué en séquestre
  @ManyToOne(() => User) user: User;         // Appartient à un utilisateur
}
```

### Qu'est-ce qu'une Migration ?

Une migration = un **script SQL automatique** qui modifie la structure de la base de données.

Exemple : "Ajouter la colonne `escrow_balance` dans la table `wallet`."

Les migrations sont numérotées par timestamp pour s'exécuter dans le bon ordre.

---

## Dossier `jobs/` — Les tâches automatiques

```
jobs/
├── jobs.module.ts                    ← Importe ScheduleModule (cron)
├── expiry-cron.service.ts            ← Expire les codes d'invitation périmés (toutes les heures)
├── delivery-group-expiry.service.ts  ← Supprime les groupes de livraison expirés
└── support-sla.cron.service.ts       ← Alerte si un ticket support dépasse son délai de réponse (SLA)
```

**Analogie** : C'est comme des alarmes programmées sur un téléphone. Elles s'exécutent automatiquement sans qu'on ait besoin de faire quoi que ce soit.

---

## Dossier `modules/` — Les 36 départements

### MODULE : `auth` — Connexion et inscription

```
modules/auth/
├── auth.controller.ts          ← Routes : POST /login, POST /register, POST /logout, etc.
├── auth.service.ts             ← Logique : vérifier le mot de passe, créer le token JWT
├── auth.module.ts              ← Importe JwtModule, PassportModule
├── guards/guards.ts            ← JwtAuthGuard + RolesGuard (version locale)
├── strategies/
│   ├── jwt.strategy.ts         ← Valide le token JWT et construit req.user
│   └── google.strategy.ts      ← Connexion avec Google OAuth
├── code-creation/              ← Codes d'invitation pour créer des comptes
│   ├── code-creation.controller.ts
│   ├── code-creation.service.ts
│   └── dto/                    ← Formulaires de création de codes
└── dto/
    ├── login.dto.ts            ← Formulaire de connexion (email + password)
    ├── register.dto.ts         ← Formulaire d'inscription
    └── password.dto.ts         ← Formulaire de changement de mot de passe
```

**Ce que fait `jwt.strategy.ts`** : Quand un token JWT arrive dans une requête, cette stratégie le décode et met le contenu dans `req.user`. Ainsi, tous les controllers peuvent savoir qui envoie la requête.

**Qu'est-ce qu'un DTO ?** Un DTO (Data Transfer Object) est un formulaire. Il définit exactement quels champs sont acceptés, leurs types et leurs contraintes (`@IsEmail()`, `@MinLength(8)`, etc.). NestJS rejette automatiquement les requêtes malformées.

---

### MODULES FINANCIERS — Le cœur de l'argent

#### `wallet-engine` — Le portefeuille

```
wallet-engine/
├── wallet.engine.ts           ← Facade : 8 opérations (crédit, débit, blocage, etc.)
├── wallet-engine.module.ts
├── wallet.engine.spec.ts      ← Tests automatisés
├── events/
│   ├── wallet.events.ts       ← Définition des événements (WALLET_CREDITED, etc.)
│   └── wallet-event-bus.service.ts ← Publie les événements
├── services/
│   ├── wallet-lock.service.ts     ← Verrou pessimiste (SELECT FOR UPDATE) — empêche 2 opérations simultanées
│   ├── wallet-movement.service.ts ← Effectue les mouvements de fonds
│   ├── wallet-ledger.service.ts   ← Tient la comptabilité (chaque ligne de débit/crédit)
│   ├── wallet-validator.service.ts ← Vérifie les règles (solde suffisant ?, wallet actif ?)
│   ├─�� wallet-history.service.ts  ← Historique des transactions
│   └── wallet-audit.service.ts    ← Log d'audit immuable
└── types/wallet-engine.types.ts   ← Types TypeScript (WalletOperation, WalletError, etc.)
```

**Analogie** : C'est comme le distributeur automatique de billets.
- Le **verrou** = personne ne peut toucher à ton compte pendant qu'une opération est en cours
- Le **ledger** = le relevé de compte complet

#### `commission-engine` — Le calcul des commissions

```
commission-engine/
├── commission.engine.ts           ← Facade : calcule et distribue la commission
├── commission.module.ts
├── commission.engine.spec.ts
├── services/
│   ├── commission-calculator.service.ts  ← Formule : Math.floor(montant × taux)
│   ├── commission-distributor.service.ts ← Répartit entre Shopi / vendeur / livreur
│   ├── commission-config.service.ts      ← Lit les taux depuis la DB
│   ├── commission-hierarchy.service.ts   ← Gère les plans (Standard, Premium, VIP)
│   ├── commission-validator.service.ts   ← Vérifie que les montants sont cohérents
│   ├── commission-history.service.ts     ← Historique
│   └── commission-audit.service.ts       ← Log d'audit
├── events/
└── types/commission.types.ts
```

**Exemple de calcul** :
```
Vente de 100 000 GNF
→ Commission Shopi (10%) : Math.floor(100000 × 0.10) = 10 000 GNF
→ Vendeur reçoit         : 60 000 GNF (60%)
→ Livreur reçoit         : 30 000 GNF (30%)
Total : 10 000 + 60 000 + 30 000 = 100 000 GNF ✓
```

`Math.floor()` est utilisé pour ne jamais avoir de décimales en GNF.

#### `escrow-engine` — Le séquestre (coffre-fort temporaire)

```
escrow-engine/
├── escrow.engine.ts           ← Machine à états : 10 états possibles
├── escrow-engine.module.ts
├── services/
│   ├── escrow-manager.service.ts  ← Crée et gère les séquestres
│   ├── escrow-release.service.ts  ← Libère l'argent vers le vendeur
│   ├── escrow-refund.service.ts   ← Rembourse le client
│   ├── escrow-validator.service.ts
│   ├── escrow-history.service.ts
│   └── escrow-audit.service.ts
└── types/escrow-engine.types.ts
```

**Les 10 états du séquestre** :
```
CREATED → FUNDS_RECEIVED → LOCKED → WAITING_VALIDATION
    ↓              ↓
DISPUTED        RELEASED (vendeur payé)
    ↓
RESOLVED / REFUNDED (client remboursé) / FAILED / EXPIRED
```

**Pourquoi un séquestre ?** Protéger le client. L'argent est bloqué jusqu'à ce que la livraison soit confirmée. Ni le vendeur ni le livreur ne peuvent toucher à l'argent avant.

#### `payment-engine` — Le moteur de paiement

```
payment-engine/
├── payment.engine.ts           ← Facade : initier, confirmer, rembourser
├── services/
│   ├── payment-session-manager.service.ts ← Gère la session de paiement (Orange Money, MTN)
│   ├── payment-webhook-processor.service.ts ← Reçoit la confirmation du provider
│   ├── payment-refund.service.ts
│   ├── payment-provider-config.service.ts  ← Config par provider
│   └── payment-audit.service.ts
└── types/payment-engine.types.ts
```

**Flux de paiement** :
```
1. Client clique "Payer"
2. payment-engine crée une session → envoie au provider (Orange Money)
3. Client confirme sur son téléphone
4. Orange Money envoie un webhook (notification automatique) au backend
5. payment-webhook-processor reçoit → confirme l'escrow
```

#### `resolution-engine` — Le juge des litiges

```
resolution-engine/
├── resolution.engine.ts
├── services/
│   ├── dispute-manager.service.ts    ← Ouvre / ferme les litiges
│   ├── evidence-manager.service.ts   ← Gère les preuves (photos, textes)
│   ├── decision-manager.service.ts   ← Prend la décision (admin)
│   ├── refund-manager.service.ts     ← Déclenche le remboursement si décision = client gagne
│   ├── resolution-history.service.ts
│   └── resolution-audit.service.ts
└── types/resolution-engine.types.ts
```

#### `settlement-engine` — Les virements vers l'extérieur

```
settlement-engine/
├── settlement.engine.ts
├── providers/                         ← Les méthodes de retrait disponibles
│   ├── orange-money-payout.provider.ts
│   ├── mtn-payout.provider.ts
│   ├── wave-payout.provider.ts
│   ├── djomy-payout.provider.ts
│   ├── moov-money-payout.provider.ts
│   ├── bank-transfer-payout.provider.ts
│   ├── payout-provider.factory.ts     ← Choisit le bon provider selon la demande
│   └── payout-provider.interface.ts   ← Contrat commun à tous les providers
├── services/
│   ├── withdrawal-manager.service.ts  ← Gère les demandes de retrait
│   ├── withdrawal-validation.service.ts ← Vérifie l'éligibilité au retrait
│   ├── eligibility-validator.service.ts
│   ├── payout-manager.service.ts      ← Effectue le virement
│   ├── settlement-scheduler.service.ts ← Traite les virements en batch (BullMQ)
│   ├── settlement-history.service.ts
│   └── settlement-audit.service.ts
└── types/settlement-engine.types.ts
```

#### `financial-config-engine` — Les règles financières configurables

```
financial-config-engine/
├── financial-config.engine.ts     ← Lit/écrit la config financière
├── services/
│   ├── financial-config-reader.service.ts  ← Lit depuis Redis (cache) ou DB
│   ├── financial-config-writer.service.ts  ← Écrit en DB + invalide le cache
│   ├── financial-config-cache.service.ts   ← Cache Redis avec SCAN (jamais KEYS *)
│   ├── financial-config-validator.service.ts
│   ├── financial-config-history.service.ts
│   └── financial-config-audit.service.ts
└── types/financial-config.types.ts
```

**9 paramètres configurables par le SUPER_ADMIN** :
Taux de commission, délai de validation, montant minimum de retrait, plafond de wallet, etc.

#### `reporting-engine` — Le comptable

```
reporting-engine/
├── reporting.engine.ts
└── services/
    ├── kpi-engine.service.ts        ← Calcule les KPIs (volume transactions, taux de succès...)
    ├── analytics.service.ts         ← Statistiques par période
    ├── statistics.service.ts
    ├── dashboard.service.ts         ← Données pour les tableaux de bord
    ├── report-generator.service.ts  ← Génère les rapports
    ├── export.service.ts            ← Export CSV/JSON
    ├── alert.service.ts             ← Alertes automatiques (anomalie financière)
    ├── audit-report.service.ts      ← Rapports d'audit
    └── reporting-cache.service.ts   ← Cache les rapports lourds
```

#### `performance-engine` — Le chronomètre

```
performance-engine/
├── performance.engine.ts           ← Circuit breaker + profiling
├── performance.controller.ts       ← GET /performance/report
├── interceptors/
│   └── performance.interceptor.ts  ← Mesure le temps de chaque requête HTTP
└── services/
    ├── redis-cache.service.ts          ← Cache générique Redis
    ├── performance-profiler.service.ts ← Collecte les métriques de latence
    ├── platform-settings-cache.service.ts ← Cache les paramètres plateforme
    └── load-protection.service.ts     ← Circuit breaker (coupe si trop d'erreurs)
```

**Circuit breaker** = interrupteur automatique :
```
CLOSED (normal) → 5 erreurs en 60s → OPEN (bloque) → 30s → HALF_OPEN → test → CLOSED
```

---

### MODULE : `wallet` — API du portefeuille

```
modules/wallet/
├── wallet.controller.ts  ← Routes : GET /wallet/balance, POST /wallet/deposit, etc.
├── wallet.service.ts     ← Appelle wallet-engine
├── wallet.module.ts
└── dto/wallet.dto.ts     ← Formulaires (montant, type d'opération...)
```

C'est la **porte d'entrée** vers `wallet-engine`. Les controllers HTTP n'appellent jamais wallet-engine directement.

---

### MODULE : `paiement` — API des paiements

```
modules/paiement/
├── paiement.controller.ts   ← POST /paiement/initier, POST /paiement/webhook/:provider
├── paiement.module.ts
├── dto/
│   └── initier-paiement.dto.ts
├── providers/
│   ├── payment-provider.interface.ts  ← Contrat IPaymentProvider
│   ├── payment-provider.factory.ts    ← Choisit Orange Money ou MTN ou FedaPay
│   ├── fedapay.provider.ts
│   └── internal.provider.ts          ← Paiement wallet-to-wallet interne
└── services/
    ├── paiement-initiation.service.ts   ← Démarre le paiement
    ├── paiement-distribution.service.ts ← Répartit après confirmation
    └── paiement-webhook.service.ts      ← Traite les notifications des providers
```

---

### MODULE : `commande` — Les commandes

```
modules/commande/
├── commande.controller.ts  ← POST /commande, GET /commande/:id, etc.
├── commande.module.ts
├── commande.scheduler.ts   ← Expire les commandes non payées après X minutes
├── dto/
│   ├── create-commande.dto.ts
│   ├── notation.dto.ts       ← Note de 1 à 5 étoiles
│   └── valider-etape.dto.ts  ← Code de validation (vendeur → livreur → client)
└── services/
    ├── commande-creation.service.ts    ← Crée la commande + déclenche l'escrow
    ├── commande-validation.service.ts  ← Valide chaque étape (code de confirmation)
    ├── commande-query.service.ts       ← Lit les commandes
    ├── commande-feedback.service.ts    ← Gère les avis et notes
    └── commande.helpers.ts             ← Fonctions utilitaires
```

**Cycle d'une commande** :
```
Client crée → EN_ATTENTE_PAIEMENT
    ↓ (paiement OK)
PAYEE → Escrow créé
    ↓ (vendeur confirme)
EN_PREPARATION
    ↓ (livreur récupère)
EN_LIVRAISON
    ↓ (client confirme réception avec code)
VALIDEE → Escrow libéré → Vendeur et Livreur payés
```

---

### MODULE : `event-orchestration` — Chef d'orchestre

```
modules/event-orchestration/
├── event-orchestration.engine.ts  ← Gère la publication et la retry des événements
├── services/
│   ├── event-bus.service.ts        ← Canal de communication interne
│   ├── event-publisher.service.ts  ← Publie les événements aux abonnés
│   ├── retry-manager.service.ts    ← Réessaie les événements échoués
│   ├── dlq.service.ts              ← Dead Letter Queue (événements définitivement échoués)
│   └── event-audit.service.ts
├── scheduler/
│   └── orchestration.scheduler.ts  ← Retraite les événements en attente (cron)
├── subscribers/
│   ├── commande.subscriber.ts      ← Écoute les événements de commande
│   ├── paiement.subscriber.ts      ← Écoute les événements de paiement
│   ├── wallet.subscriber.ts        ← Écoute les événements wallet
│   └── system.subscriber.ts        ← Écoute les événements système
└── types/events.types.ts
```

**Analogie** : C'est comme le standard téléphonique d'une entreprise. Quand quelque chose se passe (une commande est validée), le standard prévient automatiquement tous les services concernés (notifications, comptabilité, etc.) sans qu'ils aient besoin de se parler directement.

---

### MODULE : `notifications` — Les alertes

```
modules/notifications/
├── notifications.controller.ts        ← Routes publiques (liste, marquer comme lu)
├── notifications-admin.controller.ts  ← Routes admin
├── notifications.module.ts
├── gateway/
│   └── notification.gateway.ts        ← WebSocket : push des notifs en temps réel
├── queue/
│   ├── notification.queue.ts           ← File d'attente BullMQ
│   └── notification.processor.ts       ← Traite les notifications en background
├── strategies/                         ← Une stratégie par canal
│   ├── email-channel.strategy.ts       ← Envoi email
│   ├── inapp-channel.strategy.ts       ← Notif in-app (dans l'app)
│   ├── push-channel.strategy.ts        ← Push mobile
│   └── sms-channel.strategy.ts         ← SMS
├── services/
│   ├── notification.service.ts          ← Crée et envoie les notifications
│   ��── notification-dispatch.service.ts ← Dispatche vers le bon canal
│   ├── notification-broadcast.service.ts ← Envoie à plusieurs utilisateurs
│   ├── notification-preference.service.ts ← Préférences (activer/désactiver)
│   ├── notification-reminder.service.ts
│   └── notification-stats.service.ts
└── scheduler/
    └── notification.scheduler.ts        ← Rappels planifiés
```

---

### MODULE : `messagerie` — Le chat

```
modules/messagerie/
├── messagerie.controller.ts   ← REST : créer conversation, envoyer message
├── messagerie.service.ts
├── messagerie.module.ts
├── gateways/
│   ├── messagerie.gateway.ts  ← WebSocket : messages en temps réel
│   └── group-call.gateway.ts  ← WebSocket : appels de groupe
├── contacts/                  ← Sync des contacts (comme WhatsApp)
│   ├── contact-sync.controller.ts
│   ├── contact-sync.service.ts
│   ├─��� contact-discovery.service.ts
│   └── contact-matching.service.ts
├── permissions/               ← Qui peut parler à qui ?
│   ├── messaging-permission.engine.ts  ← Moteur de règles de permission
│   ├── permission-cache.service.ts     ← Cache des permissions
│   ├── messaging-audit.service.ts
│   └── evaluators/            ← Une règle par type de paire
│       ├── client-client.evaluator.ts
│       ├── client-company.evaluator.ts
│       ├── company-delivery.evaluator.ts
│       └── ...
└── services/
    ├── broadcast.service.ts   ← Diffuse à plusieurs
    └── presence.service.ts    ← Statut "en ligne / hors ligne"
```

**Règle de permission** : Tous les utilisateurs ne peuvent pas discuter avec n'importe qui. Un client peut contacter une boutique, mais pas directement un autre client (sauf s'ils ont une commande en commun).

---

### MODULE : `location` — Géolocalisation

```
modules/location/
├── location.module.ts
├── gateways/
│   └── location.gateway.ts    ← WebSocket : position GPS en temps réel
├── controllers/
│   ├── tracking.controller.ts          ← Suivi livraison en direct
│   ├── delivery-location.controller.ts ← Position du livreur
│   ├── company-location.controller.ts  ← Localisation boutique
│   ├── client-address.controller.ts    ← Adresses du client
│   └── correspondant-location.controller.ts
└── services/
    ├── tracking.service.ts
    ├── delivery-location.service.ts
    ├── geo.service.ts           ← Calcul de distances, zone de livraison
    └── route.service.ts
```

---

### MODULE : `platform-security` — La sécurité globale

```
modules/platform-security/
├── platform-security.engine.ts  ← Moteur de sécurité principal
├── platform-security.controller.ts
├── scheduler/
│   └── security.scheduler.ts    ← Tâches périodiques (nettoyage logs, scans)
└── services/
    ├── anomaly-detector.service.ts  ← Détecte les comportements suspects
    ├── alert-manager.service.ts     ← Déclenche les alertes
    ├── incident-manager.service.ts  ← Gère les incidents de sécurité
    ├── metrics-collector.service.ts ← Collecte les métriques système
    ├── observability.service.ts     ← Observabilité (logs, traces)
    ├── compliance.service.ts        ← Conformité réglementaire
    ├─��� security-event.service.ts    ← Log des événements de sécurité
    ├── backup-strategy.service.ts   ← Stratégie de sauvegarde
    └── deep-health.service.ts       ← Health check approfondi (DB, Redis, queues)
```

---

### MODULES DE CONFIGURATION PAR RÔLE

```
modules/company-settings/    ← Réglages spécifiques aux entreprises
modules/delivery-settings/   ← Réglages spécifiques aux livreurs
modules/partner-settings/    ← Réglages spécifiques aux partenaires
modules/validation-config/   ← Règles de validation des commandes (délais, codes)
modules/appearance/          ← Thème visuel (clair/sombre, couleurs)
modules/zone-admin/          ← Zones géographiques et tarifs de livraison
modules/delivery-group/      ← Groupes de livreurs
modules/geo/                 ← Données géographiques de la Guinée
```

---

### AUTRES MODULES

```
modules/catalogue/    ← Liste publique des produits et boutiques
modules/promotions/   ← Codes promo, réductions, planification
modules/public/       ← Pages accessibles sans connexion
modules/suivis/       ← Abonnements à des boutiques ou livreurs
modules/help/         ← Centre d'aide (articles, FAQ, recherche)
modules/support/      ← Tickets de support client (SAV)
modules/contact/      ← Formulaire de contact public
modules/email/        ← Envoi d'emails (nodemailer)
modules/upload/       ← Upload de fichiers (Cloudinary)
modules/dashboard/    ← Tous les dashboards (client, entreprise, livreur...)
```

---

### Dossier `dashboard/` — Les espaces par rôle (backend)

```
modules/dashboard/
├── dashboard.controller.ts       ← Route principale /dashboard
├── dashboard.module.ts
├── dashboard.service.ts
│
├── client/                       ← Espace client
│   ├── client-profil.controller.ts
│   ├── panier.controller.ts
│   ├── favoris.controller.ts
│   └── services/
│       ├── profil.service.ts
│       ├── panier.service.ts
│       ├── favoris.service.ts
│       ├── paiement.service.ts
│       ├── points.service.ts
│       └── ...
│
├── entreprise/                   ← Espace entreprise / vendeur
│   ├── entreprise-dashboard.controller.ts
│   ├── parametres.controller.ts
│   ├── produits/                 ← Gestion des produits
│   ├── clients/                  ← Liste des clients de la boutique
│   ├── livreurs/                 ← Livreurs assignés
│   ├── correspondants/           ← Correspondants partenaires
│   ├── returns/                  ← Retours et SAV
│   └── services/
│       ├── boutique-parametres.service.ts
│       ├── catalogue-parametres.service.ts
│       ├── commissions-parametres.service.ts
│       └── ...
│
├── livreur/                      ← Espace livreur
├── correspondant/                ← Espace correspondant
├── partenaire/                   ← Espace partenaire
└── super-admin/                  ← Espace super admin
    ├── super-admin.controller.ts
    ├── categories/               ← Gestion des catégories
    ├── controllers/
    │   ├── utilisateurs.controller.ts ← Gérer tous les utilisateurs
    │   ├── moderation.controller.ts   ← Contenu signalé
    │   └── reports.controller.ts      ← Rapports et statistiques
    └── services/
        ├── utilisateurs.service.ts
        ├── platform-settings.service.ts
        ├── audit-log.service.ts
        └── ...
```

---

---

# PARTIE 2 — LE FRONTEND

> Le frontend est l'**application web** que l'utilisateur voit dans son navigateur.
>
> **Technologie** : React 19 + TypeScript + Vite + Tailwind CSS + React Router

---

## Structure complète du frontend

```
shopi-frontend/
│
├── src/                        ← Tout le code source
│   ├── main.tsx                ← Point d'entrée React (monte l'application)
│   ├── app/                    ← Cœur de l'application
│   ├── modules/                ← Pages publiques par fonctionnalité
│   ├── dashboards/             ← Un tableau de bord par rôle
│   ├── shared/                 ← Code partagé entre tout le frontend
│   └── styles/                 ← Styles CSS globaux
│
└── package.json
```

---

## `src/main.tsx` — Démarrage de React

```tsx
// Ce que fait main.tsx :
ReactDOM.createRoot(document.getElementById('root')).render(
  <CartProvider>        ← Panier accessible partout
    <FavorisProvider>   ← Favoris accessibles partout
      <App />           ← L'application entière
    </FavorisProvider>
  </CartProvider>
);
```

`CartProvider` et `FavorisProvider` sont des **Context** React. Un Context c'est comme un réfrigérateur partagé dans un appartement : tout le monde dans l'appart peut y accéder sans se passer le contenu de main en main.

---

## Dossier `src/app/` — Le cœur de l'application

```
app/
├── App.tsx                    ← Composant racine (importe les styles globaux)
├── providers/
│   └── AppProviders.tsx       ← Empile tous les providers globaux
└── router.tsx                 ← Toutes les routes de l'application
```

### `router.tsx` — Le plan de navigation

C'est comme un **plan de métro**. Il dit : "si l'URL est `/login` → affiche la page Login. Si l'URL est `/dashboard/entreprise` → affiche l'app entreprise."

**Routes principales** :
```
/                     → Redirige selon le rôle (client → /home, entreprise → /dashboard/entreprise)
/login                → Page de connexion
/home                 → Page d'accueil du client
/boutique/:id         → Page d'une boutique
/produit/:id          → Page d'un produit
/commande             → Panier et passage de commande
/livreurs             → Liste des livreurs
/livreurs/:id         → Profil d'un livreur
/messagerie           → Chat
/help                 → Centre d'aide
/support              → Tickets support
/dashboard/super-admin/* → App Super Admin
/dashboard/admin/*       → App Administrateur
/dashboard/entreprise/*  → App Entreprise
/dashboard/partenaire/*  → App Partenaire
/dashboard/livreur/*     → App Livreur
/dashboard/correspondant/* → App Correspondant
/dashboard/client/*      → App Client (portefeuille)
```

**Les Guards frontend** :
```
PrivateRoute      → Vérifie que le token JWT est valide, sinon → /login
PublicOnlyRoute   → Si déjà connecté → redirige vers le dashboard
```

**Lazy loading** : Les dashboards sont chargés à la demande (pas tout au démarrage). Ça rend le premier chargement plus rapide.

---

## Dossier `src/modules/` — Les pages publiques

```
modules/
├── auth/               ← Connexion, inscription, OTP
│   ├── pages/Login.tsx
│   ├── components/     ← Formulaires, boutons de connexion
│   ├── hooks/          ← useLogin, useRegister
│   └── services/       ← Appels API auth
│
├── home/               ← La boutique principale (page d'accueil)
│   ├── pages/HomePage.tsx
│   ├── components/
│   │   ├── boutique/        ← Page d'une boutique avec ses produits
│   │   ├── produit/         ← Page d'un produit
│   │   ├── panier/          ← Panier et processus de commande
│   │   ├── livreurs/        ← Liste publique des livreurs
│   │   ├── correspondants/  ← Liste publique des correspondants
│   │   └── settings/        ← Paramètres du compte
│   ├── cards/          ← Cartes produit, carte boutique (composants visuels)
│   ├── data/           ← Données statiques (catégories mock)
│   └── hooks/          ← useHomeState (gestion de la navigation de la home)
│
├── commandes/          ← Suivi de commande
│   └── pages/CommandePage.tsx
│
├── livraisons/         ← Suivi de livraison
├── abonnements/        ← Gérer ses abonnements aux boutiques
├── utilisateurs/       ← Profils publics des utilisateurs
├── help/               ← Centre d'aide complet
│   ├── pages/
│   │   ├── HelpHomePage.tsx       ← Accueil aide
│   │   ├── HelpCategoryPage.tsx   ← Articles d'une catégorie
│   │   ├── HelpArticlePage.tsx    ← Lecture d'un article
│   │   └── HelpSearchPage.tsx     ← Résultats de recherche
│   └── services/
│
├── support/            ← Tickets de support
│   ├── pages/
│   │   ├── SupportPage.tsx        ← Liste des tickets
│   │   ├── NewTicketPage.tsx      ← Créer un ticket
│   │   └── TicketDetailPage.tsx   ← Conversation d'un ticket
│   └── services/
│
└── contact/            ← Formulaire de contact
```

---

## Dossier `src/dashboards/` — Un tableau de bord par rôle

Chaque dashboard est une **mini-application** indépendante.

### Comment fonctionne un dashboard

Chaque dashboard a la même structure :
```
*App.tsx         ← Composant principal (état de navigation, layout)
layout/
  Sidebar.tsx    ← Menu latéral
  Topbar.tsx     ← Barre du haut
pages/           ← Une page par section du dashboard
sections/        ← Sous-sections (souvent les onglets des paramètres)
components/      ← Composants visuels spécifiques à ce dashboard
data/            ← Données (souvent mock pour l'instant)
hooks/           ← Hooks personnalisés
types/           ← Types TypeScript du dashboard
styles/          ← CSS spécifiques
```

Au lieu d'utiliser React Router pour naviguer entre les pages d'un dashboard, chaque App utilise un **état interne** `activePage` :

```tsx
// Simplifié
const [activePage, setActivePage] = useState('tableau-de-bord');

// Le Sidebar appelle setActivePage quand on clique sur un lien
// PageRenderer affiche le bon composant selon activePage
```

C'est plus simple et plus rapide qu'une navigation URL pour un espace privé.

### Les 7 dashboards

```
dashboards/
├── super-admin/        ← Tout voir, tout configurer, finances globales
├── administrateur/     ← Modération, signalements, utilisateurs
├── entreprise/         ← Catalogue, commandes, livreurs, statistiques ventes
├── partenaire/         ← Intégrations, rapports partenaire
├── livreur/            ← Commandes à livrer, position GPS, gains
├── correspondant/      ← Dépôts, colis, zone géographique
└── client/             ← Portefeuille (wallet autonome)
```

---

## Dossier `src/shared/` — Code partagé par tout le frontend

```
shared/
├── services/
│   ├── apiFetch.ts          ← Client HTTP (toutes les requêtes backend passent ici)
│   ├── authUtils.ts         ← Fonctions JWT (isTokenValid, getRoleFromToken, getDashboardPath)
│   ├── walletApi.ts         ← Appels API du portefeuille
│   ├── favoris.api.ts       ← Appels API des favoris
│   ├── follow.ts            ← Appels API des abonnements
│   └── appearanceService.ts ← Appels API des préférences visuelles
│
├── context/
│   ├── AppContext.tsx        ← Context principal (user, token)
│   ├── CartContext.tsx       ← Panier global (articles, total, addToCart)
│   ├── FavorisContext.tsx    ← Favoris synchronisés partout
│   ├── ToastContext.tsx      ← Notifications visuelles (messages d'erreur, succès)
│   ├── GlobalCallContext.tsx ← Contexte d'appel vidéo individuel
│   └── GroupCallContext.tsx  ← Contexte d'appel de groupe
│
├── components/
│   ├── layout/              ← Composants de mise en page réutilisables
│   ├── ui/                  ← Boutons, modals, inputs génériques
│   ├── params/              ← Composants de paramètres partagés
│   ├── portefeuille/        ← Widget portefeuille
│   ├── HelpFab.tsx          ← Bouton flottant "?" (aide) présent partout
│   └── LivreurViewerBanner.tsx ← Bannière "Vous visualisez le profil de..."
│
├── hooks/
│   ├── useFollowToggle.ts   ← Abonner/désabonner à une boutique
│   ├── useHomeState.ts      ← État de la page d'accueil
│   ├── useReveal.ts         ← Animation d'apparition au scroll
│   ├── useStartConversation.ts ← Démarrer une conversation
│   └── useToast_correspondant.ts
│
├── messagerie/              ← Chat partagé entre tous les dashboards
│   ├── MessagerieCore.tsx   ← Composant principal du chat
│   ├── components/          ← Bulles de message, header de conversation
│   ├── hooks/               ← useMessages, useSocket
│   └── pages/MessageriePage.tsx
│
├── notifications/           ← Système de notifications temps réel
│   ├── NotificationCenter.tsx  ← Cloche avec compteur de notifs non lues
│   ├── NotificationToastStack.tsx ← Pile de toasts en bas à droite
│   ├── NotificationContext.tsx    ← Context des notifications
│   ├── notificationService.ts     ← Appels API notifications
│   └── useNotificationSocket.ts   ← Écoute les nouvelles notifs via WebSocket
│
├── location/                ← Carte et géolocalisation
│   ├── components/          ← Composants carte (Leaflet)
│   ├── hooks/               ← useLocation, useTracking
│   └── services/            ← Appels API de localisation
│
└── profils/                 ← Pages de profil public
    ├── profil-client/       ← Page de profil du client connecté
    ├── profil-entreprise/   ← Page publique d'une boutique
    ├── profil-livreur/      ← Page publique d'un livreur
    └── profil-correspondant/ ← Page publique d'un correspondant
```

### `apiFetch.ts` — Le messager

Chaque fois que le frontend veut parler au backend, il passe par `apiFetch.ts`. Ce fichier :

1. Lit le token JWT dans le `localStorage`
2. L'ajoute automatiquement dans l'en-tête `Authorization: Bearer ...`
3. Envoie la requête au backend
4. Si le backend répond 401 (token expiré) → redirige vers `/login`
5. Si le backend répond une erreur → transforme le message en quelque chose de lisible

**Analogie** : C'est comme un assistant qui parle en ton nom. Tu lui dis "je veux voir mes commandes", il traduit ça en requête HTTP et te ramène la réponse.

### `authUtils.ts` — Le lecteur de badge

```typescript
// isTokenValid : vérifie la date d'expiration dans le token
isTokenValid(token) → true/false

// getRoleFromToken : lit le rôle encodé dans le token
getRoleFromToken() → 'company' | 'client' | 'delivery' | ...

// getDashboardPath : donne la bonne URL selon le rôle
getDashboardPath('company') → '/dashboard/entreprise'
getDashboardPath('delivery') → '/dashboard/livreur'
```

---

## Dossier `src/styles/` — Styles globaux

```
styles/
├── global.css      ← Reset CSS, polices, styles de base
└── variables.css   ← Variables CSS (couleurs, tailles de police, espacements)
```

---

---

# PARTIE 3 — COMMENT LES DEUX PARLENT

```
FRONTEND (navigateur)              BACKEND (serveur Render)
       │                                    │
       │  1. POST /api/auth/login           │
       │ ─────────────────────────────────► │
       │                                    │ Vérifie email + mdp en DB
       │  2. { accessToken, refreshToken }  │
       │ ◄───────────────────────────────── │
       │                                    │
       │  3. GET /api/wallet/balance        │
       │     Authorization: Bearer <token>  │
       │ ─────────────────────────────────► │ JwtAuthGuard vérifie le token
       │                                    │ wallet.service → wallet-engine
       │  4. { balance: 50000, ... }        │
       │ ◄───────────────────────────────── │
       │                                    │
       │  5. WebSocket (Socket.io)          │
       │ ◄══════════════════════════════════ │ Nouvelle notification !
       │         "notification:new"          │ Nouveau message reçu
```

---

# PARTIE 4 — RÉSUMÉ ULTRA-SIMPLE

| Question | Réponse |
|---|---|
| C'est quoi Shopi ? | Un marché en ligne africain (Guinée) |
| Frontend = ? | Ce que tu vois dans le navigateur (React) |
| Backend = ? | Le serveur caché qui gère tout (NestJS) |
| Base de données = ? | PostgreSQL — stocke tout de façon permanente |
| Redis = ? | Mémoire rapide — stocke les infos temporaires |
| JWT = ? | Badge numérique — prouve qui tu es sans mot de passe à chaque requête |
| Entity = ? | Une table dans la base de données |
| DTO = ? | Un formulaire validé automatiquement |
| Guard = ? | Un videur qui vérifie l'identité et les permissions |
| Décorateur = ? | Un post-it collé sur une fonction pour lui donner une instruction |
| Module = ? | Un département de l'entreprise (auth, wallet, commandes...) |
| Service = ? | La logique métier (calculs, règles, accès DB) |
| Controller = ? | La porte d'entrée HTTP (reçoit les requêtes, appelle les services) |
| Engine = ? | Un moteur spécialisé (finances, sécurité, performance) |
| WebSocket = ? | Connexion permanente pour les messages et notifications temps réel |
| Context React = ? | Un réfrigérateur partagé (données accessibles partout) |
| Hook React = ? | Une fonction réutilisable pour la logique d'un composant |
| Migration = ? | Un script qui modifie la structure de la base de données |

---

*Auteur : Shopi03 · Dernière mise à jour : 2026-07-18*
