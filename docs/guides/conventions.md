# Conventions de développement — Shopi

---

## En-tête de fichier (obligatoire)

Chaque fichier TypeScript créé ou modifié doit commencer par :

```typescript
/* ============================================================
 * FICHIER : src/modules/mon-module/mon.service.ts
 * MODULE : MonModule
 * ROLE : Description courte en une phrase
 * RESPONSABILITES :
 *   - Responsabilité 1
 *   - Responsabilité 2
 * DEPENDANCES :
 *   - Repository<MonEntite> (TypeORM)
 *   - AutreService
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-18
 * ============================================================ */
```

> **Sans exception** : nouveaux fichiers, fichiers modifiés, même un petit fix.

---

## Commentaires dans le code

### Ce qu'il faut commenter

- Le **POURQUOI**, pas le QUOI
- Les contraintes non-évidentes
- Les workarounds et les raisons derrière
- Les invariants subtils

```typescript
// Mauvais :
// Récupère le wallet
const wallet = await this.walletRepo.findOne(...);

// Bon :
// SELECT FOR UPDATE nécessaire — sans verrou, deux débits simultanés
// peuvent dépasser le solde disponible (race condition PostgreSQL).
const wallet = await this.lockService.runWithLockedWallet(id, fn);
```

### Ce qu'il ne faut PAS commenter

```typescript
// Mauvais — le nom de la méthode suffit :
// Calcule le total
const total = this.calculerTotal(items);

// Mauvais — référence à la tâche courante (ça rot) :
// Ajouté pour le fix du bug #456
```

---

## Validation des DTOs

```typescript
// Toujours @IsEnum() (jamais @IsString()) pour les champs enum
@IsEnum(UserRole)
role: UserRole;

// Toujours définir les limites
@IsString()
@IsNotEmpty()
@MaxLength(255)
nom: string;

// Arrays avec limites
@IsArray()
@ArrayMinSize(1)
@ArrayMaxSize(10)
items: string[];
```

---

## Gestion des erreurs

Toutes les erreurs exposées au client passent par des exceptions custom :

```typescript
// Interdit — expose des détails internes
throw new Error('Cannot read property wallet of undefined');

// Correct — message contrôlé, pas de stack trace
throw new WalletErreur(WalletErreurType.WALLET_INTROUVABLE, 'Wallet introuvable');
```

Les erreurs inconnues sont wrappées :

```typescript
try {
  // ...
} catch (err) {
  if (err instanceof WalletErreur) throw err;
  this.logger.error('Erreur inattendue', err);
  throw new WalletErreur(WalletErreurType.ERREUR_INTERNE);
}
```

---

## Nommage

| Type | Convention | Exemple |
|---|---|---|
| Classes | PascalCase | `WalletEngine`, `CommissionCalculatorService` |
| Fichiers | kebab-case | `wallet.engine.ts`, `commission-calculator.service.ts` |
| Variables, fonctions | camelCase | `walletId`, `calculerTotal()` |
| Constantes | SCREAMING_SNAKE | `WALLET_EVENTS`, `MAX_RETRIES` |
| Enums | PascalCase (membre SCREAMING) | `WalletStatus.ACTIVE` |
| Interfaces | PascalCase (pas de préfixe I) | `WalletOperationContext` |
| Tables DB | snake_case | `wallet_transaction`, `commande_item` |

---

## Structure d'un module NestJS

```
module/
├── *.module.ts          ← Déclarations NestJS
├── *.controller.ts      ← Routes HTTP, validation input
├── *.service.ts         ← Logique métier principale
├── dto/
│   └── *.dto.ts         ← Validation avec class-validator
├── entities/ (ou depuis database/entities/)
└── *.spec.ts            ← Tests au même niveau que le fichier testé
```

---

## Imports

Ordre des imports :
1. Node.js built-ins
2. Packages tiers (nestjs, typeorm, rxjs…)
3. Modules internes du projet (`../../common/…`)
4. Types du même module

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WalletErreur } from '../../common/exceptions/wallet.exceptions';
import { Wallet } from '../../database/entities/wallet.entity';

import { WalletLockService } from './services/wallet-lock.service';
import { WalletErreurType } from './types/wallet-engine.types';
```

---

## Audit et événements (fire-and-forget)

Les opérations d'audit et d'émission d'événements ne doivent **jamais** bloquer le chemin critique :

```typescript
// Correct — fire-and-forget
this.auditService.logOperationReussie(ctx).catch(err =>
  this.logger.error('Audit failed', err)
);
this.eventBus.emit(WALLET_EVENTS.SUCCESS, event);

// Interdit — bloque la réponse
await this.auditService.logOperationReussie(ctx);  // ← NE PAS faire
```

---

## Sécurité

- Valider toutes les entrées avec `ValidationPipe({ whitelist: true })`
- Ne jamais exposer des données sensibles dans les messages d'erreur
- Utiliser `@IsEnum()` pour les champs enum (évite les injections via strings arbitraires)
- Rate limiting activé globalement (60 req/min/IP via ThrottlerModule)
- JWT vérifié sur toutes les routes protégées (`JwtAuthGuard`)
- RBAC via `RolesGuard` + `@Roles()`
