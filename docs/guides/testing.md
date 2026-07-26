# Guide — Exécution des tests

## Structure des tests

```
shopi-backend/
├── src/
│   └── modules/
│       ├── wallet-engine/services/wallet-validator.service.spec.ts  ← unitaire pur
│       ├── commission/services/commission-calculator.service.spec.ts ← unitaire pur
│       └── performance-engine/performance.engine.spec.ts             ← unitaire mocké
├── test/
│   ├── integration/
│   │   └── financial-engines.integration.spec.ts  ← intégration
│   ├── e2e/
│   │   └── auth.e2e-spec.ts                        ← E2E HTTP
│   └── security/
│       ├── rbac.security.spec.ts                   ← RBAC
│       └── api-injection.security.spec.ts          ← Injections
└── jest.config.ts   ← 3 projets : unit / integration / security
```

---

## Commandes

### Tests unitaires (rapides, aucune dépendance externe)

```bash
# Tous les tests unitaires
npx jest --selectProjects unit

# Un fichier spécifique
npx jest wallet-validator.service.spec.ts

# Avec couverture
npx jest --selectProjects unit --coverage

# Watch mode (développement)
npx jest --selectProjects unit --watch
```

### Tests d'intégration

```bash
npx jest --selectProjects integration --forceExit
```

### Tests E2E

```bash
npx jest --config test/jest-e2e.json
```

### Tests de sécurité

```bash
npx jest --selectProjects security --forceExit
```

### Tous les tests (comme en CI)

```bash
npx jest --ci --forceExit
```

---

## Seuils de couverture

Définis dans `jest.config.ts` :

| Métrique | Seuil global | Seuil renforcé (services purs) |
|---|---|---|
| Branches | 60% | 90% |
| Fonctions | 70% | 90% |
| Lignes | 70% | 90% |
| Statements | 70% | 90% |

Services purs soumis au seuil renforcé 90% :
- `wallet-validator.service.ts`
- `commission-calculator.service.ts`

---

## Helpers de test

```typescript
// Factories wallet
import { makeWallet, makeWalletCtx, makeTransferCtx }
  from 'src/test/helpers/wallet.test-helper';

// Factories commission
import { makeCommissionRule, makeCommissionContext }
  from 'src/test/helpers/commission.test-helper';
```

---

## Variables d'environnement pour les tests

Configurées dans `src/test/setup/jest.global-setup.ts` :
- `NODE_ENV=test`
- `JWT_SECRET=shopi-test-jwt-secret-32chars-min`
- `REDIS_HOST=localhost` / `REDIS_PORT=6379`
- `MAIL_TRANSPORT=stub`

---

## Écrire un test unitaire (exemple)

```typescript
/* ============================================================
 * FICHIER : src/modules/mon-module/services/mon.service.spec.ts
 * ============================================================ */

import { MonService } from './mon.service';

describe('MonService', () => {
  let service: MonService;

  beforeEach(() => {
    service = new MonService(); // Pas de mock si pur
  });

  describe('maMethode()', () => {
    it('retourne X pour une entrée valide', () => {
      const result = service.maMethode(valeur);
      expect(result).toBe(attendu);
    });

    it('lève MonErreur pour une entrée invalide', () => {
      expect(() => service.maMethode(invalide)).toThrow(MonErreur);
    });
  });
});
```

---

## Écrire un test d'intégration avec NestJS TestingModule

```typescript
const module = await Test.createTestingModule({
  providers: [
    MonEngine,
    { provide: MonRepository, useValue: mockRepo },
    { provide: MonAuditService, useValue: mockAudit },
  ],
}).compile();

const engine = module.get<MonEngine>(MonEngine);
```

---

## Rapport JUnit (CI)

Les rapports de test sont générés dans `reports/junit.xml` (configuré via `jest-junit` reporter dans `jest.config.ts`). Uploadés par GitHub Actions comme artefact.
