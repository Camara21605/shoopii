# Module `config` — Configuration globale de l'application

> **Rôle** : Centraliser toutes les connexions aux services externes (base de données, cache, stockage d'images, authentification).  
> C'est le **panneau de branchements électriques** de Shopi : avant que l'application démarre, chaque fil (service) est branché ici.

---

## Pourquoi ce module existe

Sans configuration centralisée, chaque module devrait connaître les mots de passe, URLs et clés API par lui-même.
`config` résout ça : il lit les variables d'environnement **une seule fois** et les distribue à qui en a besoin via `ConfigService`.

**Règle de sécurité absolue** : Aucune valeur sensible (mot de passe, secret JWT, clé API) ne doit jamais être écrite directement dans le code. Tout passe par les variables d'environnement (fichier `.env` en dev, panneau Render en production).

---

## Organisation interne

```
src/config/
├── cloudinary.config.ts   — Connexion au service de stockage d'images (Cloudinary)
├── database.config.ts     — Connexion à la base de données PostgreSQL (via TypeORM)
├── env.config.ts          — ⚠️ VIDE — placeholder non implémenté
└── redis.config.ts        — Connexion au cache Redis (ioredis)
    jwt.config.ts          — ⚠️ VIDE — placeholder non implémenté
```

> **Note** : `env.config.ts` et `jwt.config.ts` sont des fichiers vides.
> La validation des variables d'environnement est gérée dans `AppModule` via `ConfigModule.forRoot()`.
> La configuration JWT est définie directement dans `src/modules/auth/auth.module.ts`.

---

## Composants en détail

### `cloudinary.config.ts` — Stockage d'images

Imagine Cloudinary comme un **album photo professionnel en ligne** : quand un vendeur uploade une photo de son produit, elle est envoyée là.

Ce fichier crée un fournisseur NestJS (`CLOUDINARY`) qui configure le SDK Cloudinary avec 3 clés issues du `.env` :

| Variable d'environnement | Ce que c'est |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Le nom de votre "espace" Cloudinary (visible dans le tableau de bord) |
| `CLOUDINARY_API_KEY` | L'identifiant public pour s'authentifier |
| `CLOUDINARY_API_SECRET` | Le mot de passe secret — **ne jamais exposer côté client** |

**Utilisation** : Le module `upload` injecte ce provider via `@Inject('CLOUDINARY')` pour uploader/supprimer des images.

---

### `database.config.ts` — Base de données PostgreSQL

C'est le fichier le plus complexe du module. Il dit à TypeORM comment se connecter à PostgreSQL et quelles tables (entités) existent.

**Variables d'environnement requises** :

| Variable | Exemple | Obligatoire |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | **OUI** — crash si absente |
| `NODE_ENV` | `production` ou `development` | Oui |
| `DB_SSL` | `true` ou `false` | Non (auto en prod) |
| `DB_SYNC` | `true` ou `false` | Non — **JAMAIS `true` en prod** |

**Comportement SSL** :
```
NODE_ENV=production  → SSL activé automatiquement
DB_SSL=true          → SSL forcé (même en dev)
Autre               → SSL désactivé (dev local sans SSL)
```

**Pool de connexions** :
```
min: 2 connexions permanentes
max: 20 connexions simultanées
idle timeout: 30s (libère les connexions inutilisées)
connection timeout: 5s (échec si pas de connexion après 5s)
```

**Liste des 60+ entités enregistrées** (dans l'ordre des dépendances) :

| Groupe | Entités |
|---|---|
| Socle | `User`, `PanierItem`, `Category`, `SubCategory` |
| Profils | `Admin`, `Partner`, `Company`, `Delivery`, `Correspondent`, `Client` |
| Finance | `Wallet`, `WalletTransaction` |
| Catalogue | `Product`, `ProductVariant`, `ProductSpec`, `ProductWholesaleTier`, `ProductMedia`, `ProductStory`, `ProductLike`, `Promotion`, `PromotionProduct`, `PromotionUsage` |
| Commandes | `Commande`, `CommandeItem`, `CommandeCode` |
| Messagerie | `Conversation`, `ConversationPermission`, `Message`, `MessageReadReceipt`, `MessagingAuditLog` |
| Notifications | `Notification`, `NotificationPreference`, `NotificationDeliveryLog` |
| Social | `Follow`, `FollowRequest`, `FollowBlock` |
| Localisation | `Localisation`, `CompanyBranch`, `LocationHistory` |
| Retours/SAV | `ReturnRequest`, `ReturnEvidence`, `ReturnHistory`, `SavTicket`, `SavMessage` |
| Contacts | `UserContact`, `ContactSyncSession` |
| Aide | `HelpCategory`, `HelpArticle`, `HelpFaqItem`, `HelpSearchQuery` |
| Support | `SupportTicket`, `SupportMessage`, `Attachment` |
| Géographie | `GeoPays`, `GeoRegion`, `GeoPrefecture`, `GeoCommune`, `GeoQuartier`, `GeoZone` |
| Config | `PlatformSettings`, `ValidationConfig`, `CompanySetting`, `DeliverySetting`, `PartnerSetting`, `AppearancePreference` |
| Livraison | `DeliveryGroup`, `DeliveryGroupMember`, `GroupMessage` |
| Divers | `AuditLog`, `Report`, `ContactMessage`, `CreationCode`, `LivreurHoraire`, `CorrespondantHoraire`, `CompanyHoraire`, `CompanyAvis`, `CompanyType` |

---

### `redis.config.ts` — Cache Redis

Redis est comme un **tableau blanc** : très rapide à lire et écrire, mais les données peuvent disparaître si Redis redémarre (contrairement à PostgreSQL).

Shopi l'utilise pour :
- **BullMQ** — file d'attente de jobs (emails, notifications)
- **Cache** — données fréquemment lues (config financière, catégories)
- **Sessions** — tokens de rafraîchissement (futur)

**Variables d'environnement** :

| Variable | Défaut | Description |
|---|---|---|
| `REDIS_HOST` | `127.0.0.1` | Adresse du serveur Redis |
| `REDIS_PORT` | `6379` | Port (standard Redis) |
| `REDIS_PASSWORD` | _(vide)_ | Mot de passe si Redis est sécurisé |

**Stratégie de reconnexion** :
```
Tentative 1 → attendre 500ms
Tentative 2 → attendre 1000ms
...
Tentative 6 → attendre 3000ms (max)
Tentative 21 → STOP, log d'erreur, renvoie null
```

**Options clés** :
- `lazyConnect: true` → Ne se connecte pas au démarrage ; attend la première commande. **Requis pour BullMQ.**
- `maxRetriesPerRequest: null` → BullMQ gère lui-même les retries ; sans cette option il y aurait des conflits.
- `enableReadyCheck: false` → Compatible avec les instances Redis managées (Upstash, Redis Cloud).

---

### `env.config.ts` — FICHIER VIDE

Ce fichier n'a pas encore été implémenté. La validation des variables d'environnement se fait actuellement via `ConfigModule.forRoot()` dans `AppModule`, sans schéma de validation explicite (pas de Joi ou Zod).

**Recommandation** : Implémenter ici un schéma de validation Joi ou Zod pour que l'application crashe au démarrage avec un message explicite si une variable critique est manquante, plutôt que de crasher plus tard avec un message obscur.

---

### `jwt.config.ts` — FICHIER VIDE

Ce fichier n'a pas encore été implémenté. La configuration JWT (secrets, durées d'expiration) est définie directement dans `src/modules/auth/auth.module.ts` via `JwtModule.registerAsync()`.

**Recommandation** : Centraliser ici les constantes JWT pour éviter leur répétition dans `auth.module.ts` et les rendre documentées.

---

## Flux d'initialisation au démarrage

```mermaid
sequenceDiagram
    participant App as AppModule (main.ts)
    participant Cfg as ConfigModule
    participant DB  as database.config
    participant Red as redis.config
    participant Cld as cloudinary.config

    App->>Cfg: ConfigModule.forRoot() — charge le .env
    App->>DB: TypeOrmModule.forRootAsync(databaseConfigFactory)
    DB->>DB: Vérifie DATABASE_URL présente ?
    alt DATABASE_URL absente
        DB-->>App: ❌ CRASH — Error explicite
    else DATABASE_URL présente
        DB->>DB: Configure SSL selon NODE_ENV
        DB-->>App: ✅ Pool de connexions prêt (2–20 connexions)
    end

    App->>Red: redisConfig chargé (pas de connexion immédiate)
    Note over Red: lazyConnect=true → connexion différée

    App->>Cld: CloudinaryProvider initialisé
    Cld->>Cfg: Lit CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET
    Cld-->>App: ✅ SDK Cloudinary configuré
```

---

## Dépendances

### Ce module dépend de :
- `@nestjs/config` — `ConfigService` pour lire les variables d'environnement
- `@nestjs/typeorm` — `TypeOrmModuleOptions`
- `cloudinary` (SDK) — package npm `cloudinary`
- `ioredis` — client Redis (via `redis.config.ts`)
- Toutes les entités de `src/database/entities/**`

### Les modules suivants dépendent de `config` :
- **AppModule** — importe `databaseConfigFactory`, `redisConfig`, `CloudinaryProvider`
- **AuthModule** — lit `JWT_SECRET`, `JWT_REFRESH_SECRET` via `ConfigService`
- **UploadModule** — inject `'CLOUDINARY'` pour uploader des images
- **BullMQ Queues** — utilisent `redisConfig` pour se connecter à Redis
- **FinancialConfigEngine** — lit `redisConfig` pour le cache des configs financières

---

## Règles métier

1. **DATABASE_URL manquante = crash immédiat** : Pas de fallback, pas de localhost implicite. Le message d'erreur indique explicitement comment corriger.
2. **DB_SYNC=true interdit en production** : Laisse TypeORM modifier les tables automatiquement → risque de perte de données.
3. **SSL toujours actif en production** : Supabase/Neon exigent SSL. `rejectUnauthorized: false` est intentionnel pour accepter les certificats auto-signés de ces hébergeurs.
4. **Redis non-bloquant** : `lazyConnect: true` + `maxRetriesPerRequest: null` = BullMQ démarre même si Redis est temporairement down.
5. **family: 4 (IPv4 forcé)** : Résout les problèmes de DNS IPv6 sur Render/Supabase où `::1` est inaccessible.

---

## ⚠️ Incohérences détectées (Phase 12 — Vérification)

### 1. Imports absolus mélangés avec imports relatifs dans `database.config.ts`

```typescript
// ❌ Imports absolus (3 occurrences) — fragiles si tsconfig.paths change
import { Promotion }     from 'src/database/entities/entreprise.table/promotion.entity';
import { PromotionUsage } from 'src/database/entities/entreprise.table/promotion-usage.entity';
import { MessageReadReceipt } from 'src/database/entities/messaging/message-read-receipt.entity';

// ✅ Style correct utilisé partout ailleurs
import { Category } from '../database/entities/entreprise.table/category.entity';
```

**Impact** : Si `tsconfig.json` change le `baseUrl`, les 3 imports absolus cassent silencieusement en build.
**Recommandation** : Normaliser vers les imports relatifs `../database/...`.

### 2. `env.config.ts` et `jwt.config.ts` vides

Ces fichiers suggèrent une intention de centraliser la configuration, mais ne contiennent rien. Pas de validation des variables d'environnement au démarrage → une variable manquante cause un crash tardif avec un message peu clair.

### 3. `DB_SYNC` sans garde-fou en production

```typescript
synchronize: config.get<string>('DB_SYNC') === 'true',
```

Si quelqu'un met `DB_SYNC=true` en production par erreur, TypeORM peut **modifier ou supprimer des colonnes** sans avertissement. Il n'y a pas de vérification `NODE_ENV !== 'production'` avant d'activer ce flag.

**Recommandation** :
```typescript
synchronize: config.get('NODE_ENV') !== 'production' && config.get('DB_SYNC') === 'true',
```

---

## Règles de modification

| Fichier | Risque | Précaution |
|---|---|---|
| `database.config.ts` | **CRITIQUE** — toutes les entités, SSL, pool | Tester connexion prod après chaque changement |
| `redis.config.ts` | **ÉLEVÉ** — BullMQ + cache | Vérifier `lazyConnect` et `maxRetriesPerRequest` toujours présents |
| `cloudinary.config.ts` | **MOYEN** — upload images | Vérifier que `'CLOUDINARY'` token reste cohérent avec `@Inject('CLOUDINARY')` |
| `env.config.ts` | **FAIBLE** — vide actuellement | Implémenter validation Joi/Zod avant d'ajouter du code |
| `jwt.config.ts` | **FAIBLE** — vide actuellement | Centraliser ici avant de toucher `auth.module.ts` |

---

## Points d'extension

1. **Ajouter une nouvelle entité** : Importer l'entité dans `database.config.ts` et l'ajouter au tableau `entities: [...]`.
2. **Implémenter la validation env** : Créer un schéma Joi dans `env.config.ts` et l'injecter dans `ConfigModule.forRoot({ validationSchema })`.
3. **Centraliser la config JWT** : Écrire dans `jwt.config.ts` les constantes `accessTokenExpiry` et `refreshTokenExpiry`, les importer dans `auth.module.ts`.
4. **Activer Redis Sentinel/Cluster** : Remplacer l'objet plat `redisConfig` par une configuration `sentinels: [...]` dans `redis.config.ts`.

---

*Auteur : Shopi03 · Dernière mise à jour : 2026-07-18*
