# Documentation Shopi

Bienvenue dans la documentation technique officielle de **Shopi** — plateforme e-commerce multi-acteurs (Guinée) avec système de paiement escrow, moteurs financiers et gestion multi-rôles.

---

## Navigation rapide

| Sujet | Lien |
|---|---|
| Architecture globale | [/architecture](./architecture/README.md) |
| Moteurs financiers | [/finance](./finance/README.md) |
| APIs REST | [/api](./api/README.md) |
| Base de données | [/database/README.md](./database/README.md) |
| Règles métier | [/business-rules](./business-rules/README.md) |
| Guides développeurs | [/guides](./guides/README.md) |
| Décisions (ADR) | [/decisions](./decisions/README.md) |
| Sécurité | [/security/README.md](./security/README.md) |
| Tests | [/testing/README.md](./testing/README.md) |
| Déploiement | [/deployment/README.md](./deployment/README.md) |
| Opérations | [/operations/README.md](./operations/README.md) |

---

## Vue d'ensemble

```
Shopi
├── shopi-backend/      NestJS + TypeORM + PostgreSQL + Redis
│   ├── src/modules/    ~40 modules fonctionnels
│   ├── src/database/   Entités, migrations, database.module
│   ├── src/common/     Guards, décorateurs, exceptions, middleware
│   ├── src/config/     Configuration env (db, jwt, redis, cloudinary)
│   └── test/           Tests unitaires, intégration, E2E, sécurité
└── shopi-frontend/     React 19 + TypeScript + Vite + CSS Modules
    ├── src/modules/    Pages publiques (help, support, home…)
    ├── src/dashboards/ Apps par rôle (client, company, delivery…)
    └── src/shared/     Services communs (apiFetch, auth…)
```

## Rôles utilisateurs

| Rôle | Description |
|---|---|
| `CLIENT` | Acheteur — passe des commandes |
| `COMPANY` | Entreprise — vend des produits |
| `DELIVERY` | Livreur — effectue les livraisons |
| `PARTNER` | Partenaire commercial |
| `CORRESPONDENT` | Correspondant local |
| `ADMIN` | Administrateur — gestion de la plateforme |
| `SUPER_ADMIN` | Super-administrateur — accès complet |

## Monnaie

Toutes les transactions sont en **GNF** (Franc Guinéen). Pas de virgule flottante — les montants sont des entiers.

## Conventions

- En-tête obligatoire sur chaque fichier (voir [guides/conventions.md](./guides/conventions.md))
- Pas de stack trace exposée au client
- OWASP Top 10 respecté sur chaque endpoint
- Clés sensibles uniquement en variables d'environnement
