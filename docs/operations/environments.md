# Gestion des environnements

## Les 4 environnements

```
développement  ──→  test  ──→  staging  ──→  production
     local          CI          pré-prod         live
```

---

## Développement (local)

| Paramètre | Valeur |
|---|---|
| NODE_ENV | `development` |
| Base de données | `shopi_dev` (locale) |
| Redis | `localhost:6379` |
| Email | Transport `stub` (pas d'envoi réel) |
| Paiement | Mode sandbox providers |
| Logging | Verbeux, colorisé |

Fichier : `shopi-backend/.env` (gitignored)

```env
NODE_ENV=development
DATABASE_URL=postgres://user:pass@localhost:5432/shopi_dev
REDIS_URL=redis://localhost:6379
MAIL_TRANSPORT=stub
APP_VERSION=dev
```

---

## Test (CI — GitHub Actions)

| Paramètre | Valeur |
|---|---|
| NODE_ENV | `test` |
| Base de données | `shopi_test` (éphémère en CI) ou mocks TypeORM |
| Redis | `localhost:6379` (service GitHub Actions) |
| Email | Transport `stub` |
| Secrets JWT | Secrets GitHub dédiés |

Fichier : `shopi-backend/.env.test` (gitignored)
Variables injectées dans le CI via GitHub Secrets.

```env
NODE_ENV=test
JWT_SECRET=${{ secrets.JWT_SECRET_TEST }}
JWT_REFRESH_SECRET=${{ secrets.JWT_REFRESH_SECRET_TEST }}
REDIS_HOST=localhost
REDIS_PORT=6379
MAIL_TRANSPORT=stub
```

---

## Staging (préproduction)

| Paramètre | Valeur |
|---|---|
| NODE_ENV | `staging` |
| Base de données | PostgreSQL dédié (ex: `shopi_staging`) |
| Redis | Instance Redis dédiée |
| Email | Transport réel avec adresses de test |
| Paiement | Mode sandbox |
| URL | `https://staging.shopi.com` (ou sous-domaine Render) |

Objet : reproduire la production à l'identique pour les tests de recette.

**Règle stricte** : aucune donnée de production en staging.

---

## Production

| Paramètre | Valeur |
|---|---|
| NODE_ENV | `production` |
| Base de données | PostgreSQL managé (ex: Render PostgreSQL, Neon, Supabase) |
| Redis | Redis managé (ex: Upstash, Railway) |
| Email | SMTP production |
| Paiement | Mode live |
| SSL | Obligatoire (`DB_SSL=true`) |
| URL | `https://api.shopi.com` |

Hébergement actuel : **Render** (render.yaml)

---

## Isolation des données

| Règle | Status |
|---|---|
| Données prod jamais en dev/staging | Obligatoire |
| Secrets différents par environnement | Obligatoire |
| Migrations testées en staging avant prod | Obligatoire |
| Backups sur prod uniquement | Obligatoire |

---

## Variables spécifiques par environnement

| Variable | Dev | Test | Staging | Prod |
|---|---|---|---|---|
| `NODE_ENV` | development | test | staging | production |
| `LOG_LEVEL` | debug | warn | info | warn |
| `THROTTLE_LIMIT` | 1000 | 10000 | 100 | 60 |
| `JWT_ACCESS_EXPIRES_IN` | 24h | 15m | 15m | 15m |
| `DB_SSL` | false | false | true | true |
| `APP_VERSION` | dev | sha-$COMMIT | tag | tag |
