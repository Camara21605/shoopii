# ADR-001 — Choix du framework backend : NestJS

**Statut** : Accepté  
**Date** : 2025

---

## Contexte

Shopi est une plateforme e-commerce multi-acteurs destinée au marché guinéen avec des exigences élevées en termes de :
- Sécurité (authentification, RBAC, validation)
- Scalabilité (modules indépendants, queues asynchrones)
- Maintenabilité (TypeScript strict, conventions de code)
- Vitesse de développement (décorateurs, injection de dépendances)

## Problème

Choisir un framework backend Node.js adapté à un projet de grande envergure avec plusieurs développeurs et une architecture modulaire.

## Options envisagées

### 1. Express.js (pur)
**Avantages** : Léger, flexible, large écosystème  
**Inconvénients** : Pas de structure imposée, boilerplate important, DI manuelle

### 2. Fastify
**Avantages** : Performances élevées, TypeScript natif  
**Inconvénients** : Moins d'écosystème que NestJS, DI moins mature

### 3. NestJS
**Avantages** : Architecture modulaire opinionated, DI intégrée, décorateurs TypeScript, support BullMQ/TypeORM/Redis natif, Swagger intégré  
**Inconvénients** : Courbe d'apprentissage initiale, abstraction parfois lourde

## Décision

**NestJS** avec TypeScript strict.

## Justification

- Architecture modulaire alignée avec la décomposition en moteurs financiers
- Injection de dépendances native évite le couplage fort
- Guards et intercepteurs pour sécurité centralisée (JwtAuthGuard, RolesGuard)
- Decorateurs `@Roles()`, `@Public()` pour contrôle d'accès déclaratif
- Intégrations officielles : TypeORM, BullMQ, Redis, EventEmitter2, Swagger
- ValidationPipe avec class-validator pour la validation des inputs

## Conséquences

✅ Architecture cohérente et prévisible pour tous les modules  
✅ Tests unitaires facilités par l'injection de dépendances  
✅ Swagger auto-généré depuis les décorateurs  
⚠️ Tous les nouveaux développeurs doivent apprendre les patterns NestJS  
⚠️ Plus verbeux que Express pour les cas simples
