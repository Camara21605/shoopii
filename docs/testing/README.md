# Tests — Vue d'ensemble

Documentation complète dans [guides/testing.md](../guides/testing.md).

---

## Résumé

| Type | Projet Jest | Fichiers | Tests |
|---|---|---|---|
| Unitaire pur | `unit` | `*.spec.ts` dans `src/` | ~95 |
| Intégration | `integration` | `test/integration/*.spec.ts` | ~20 |
| E2E | (jest-e2e.json) | `test/e2e/*.e2e-spec.ts` | ~15 |
| Sécurité | `security` | `test/security/*.spec.ts` | ~50 |
| **Total** | | | **~180** |

---

## Couverture

```bash
npx jest --selectProjects unit --coverage
```

Seuils dans `jest.config.ts` :
- Branches : 60% (global), 90% (services purs)
- Fonctions/Lignes/Statements : 70% (global), 90% (services purs)

---

## CI/CD

Pipeline GitHub Actions `.github/workflows/qa-pipeline.yml` :
- Lint → TypeCheck → Tests unitaires + Coverage Gate → Intégration → Sécurité → Build → Audit npm

Voir [guides/testing.md](../guides/testing.md) pour le détail complet.
