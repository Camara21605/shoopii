# Architecture Decision Records (ADR)

Les ADR documentent les décisions d'architecture importantes de Shopi — leur contexte, les alternatives envisagées, la décision retenue et ses conséquences.

---

## Index

| ADR | Titre | Statut | Date |
|---|---|---|---|
| [ADR-001](./ADR-001-nestjs-framework.md) | Choix du framework backend : NestJS | Accepté | 2025 |
| [ADR-002](./ADR-002-postgresql-typeorm.md) | Base de données : PostgreSQL + TypeORM | Accepté | 2025 |
| [ADR-003](./ADR-003-redis-cache-queue.md) | Redis pour le cache et les queues | Accepté | 2025 |
| [ADR-004](./ADR-004-financial-engines.md) | Architecture en moteurs financiers isolés | Accepté | 2026 |
| [ADR-005](./ADR-005-event-bus.md) | EventEmitter2 pour la communication inter-modules | Accepté | 2026 |
| [ADR-006](./ADR-006-escrow-pattern.md) | Pattern Escrow pour les transactions | Accepté | 2026 |
| [ADR-007](./ADR-007-jwt-auth.md) | JWT avec access + refresh tokens | Accepté | 2025 |

---

## Format d'un ADR

```markdown
# ADR-XXX — Titre

## Statut
Proposé | Accepté | Remplacé par ADR-YYY | Obsolète

## Contexte
Quel problème devait être résolu.

## Problème
Contraintes et forces en jeu.

## Options envisagées
1. Option A — avantages / inconvénients
2. Option B — avantages / inconvénients

## Décision
Ce qui a été choisi.

## Justification
Pourquoi cette option plutôt que les autres.

## Conséquences
Effets positifs et négatifs de cette décision.
```
