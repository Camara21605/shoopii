# ADR-002 — Base de données : PostgreSQL + TypeORM

**Statut** : Accepté  
**Date** : 2025

---

## Contexte

Shopi stocke des données financières critiques (transactions, wallets, escrows), des données relationnelles complexes (commandes → items → produits → variantes) et des données géographiques hiérarchiques (pays → région → commune → quartier).

## Décision

**PostgreSQL 15** comme SGBD, **TypeORM** comme ORM.

## Justification

- **PostgreSQL** : transactions ACID, `SELECT FOR UPDATE` (verrou pessimiste pour le wallet), types JSON natifs, full-text search, indexes performants
- **TypeORM** : intégration native NestJS, migrations versionnées, décorateurs TypeScript, support des relations complexes
- `synchronize: false` en production — les migrations TypeORM garantissent la reproductibilité

## Règles d'utilisation

1. `synchronize: false` toujours en production
2. Toute modification de schéma passe par une migration
3. Montants financiers en `integer` (GNF) — jamais `float`
4. Soft delete via `@DeleteDateColumn` — jamais de suppression physique des données financières
5. Clés idempotence : index UNIQUE partiel sur `wallet_transaction.idempotency_key WHERE idempotency_key IS NOT NULL`

## Conséquences

✅ Intégrité des données financières garantie par les transactions ACID  
✅ `SELECT FOR UPDATE` empêche les race conditions sur les wallets  
✅ Migrations versionnées → déploiements reproductibles  
⚠️ PostgreSQL nécessite une instance dédiée (coût infrastructure)  
⚠️ Les migrations mal écrites peuvent verrouiller les tables en production
