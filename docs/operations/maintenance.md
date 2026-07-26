# Stratégie de maintenance de la documentation

---

## Principe fondamental

La documentation est traitée comme du code : **elle évolue avec le code, jamais après**.

---

## Règles lors des revues de code (Pull Requests)

### Obligatoire pour tout PR qui :

| Changement | Documentation requise |
|---|---|
| Nouveau module | Ajouter une entrée dans `/docs/architecture/README.md` |
| Nouveau moteur financier | Créer `docs/finance/<nom-moteur>.md` |
| Nouvelle règle métier | Mettre à jour `docs/business-rules/README.md` |
| Nouveau endpoint API | Mettre à jour `docs/api/README.md` |
| Nouvelle entité DB | Mettre à jour `docs/database/README.md` |
| Nouvelle migration | Ajouter à la table historique dans `docs/database/README.md` |
| Nouveau provider de paiement | Mettre à jour `docs/finance/payment-engine.md` et `docs/finance/settlement-engine.md` |
| Nouveau rôle utilisateur | Mettre à jour `docs/business-rules/README.md`, `docs/api/README.md`, ADR si décision significative |
| Changement de configuration | Mettre à jour `docs/guides/environment.md` |
| Décision d'architecture | Créer un nouvel ADR dans `docs/decisions/` |

### Checklist PR (à ajouter dans le template GitHub)

```markdown
## Documentation
- [ ] En-tête fichier mis à jour (DERNIERE MISE A JOUR)
- [ ] docs/ mis à jour si changement d'architecture, API, DB ou règle métier
- [ ] ADR créé si décision d'architecture significative
- [ ] Guides mis à jour si nouvelle procédure
```

---

## Vérifications périodiques

### Revue mensuelle

- Vérifier que les ADR reflètent toujours la réalité du code
- Mettre à jour les dates dans les mémoires qui ont évolué
- Vérifier les liens internes dans la documentation

### Revue trimestrielle

- Audit complet des règles métier (les délais configurables ont-ils changé ?)
- Vérifier les seuils de couverture de tests (à ajuster si de nouveaux services critiques ont été ajoutés)
- Mettre à jour `docs/database/README.md` avec les nouvelles entités et migrations

---

## Signaux d'alarme

Si vous constatez l'un de ces signes, la documentation doit être mise à jour immédiatement :

- Un fichier `.ts` ne commence pas par l'en-tête standard
- Un moteur financier n'a pas de fichier dans `docs/finance/`
- Une règle métier dans le code n'est pas dans `docs/business-rules/`
- Un endpoint API n'est pas dans `docs/api/README.md`
- Une migration n'est pas dans le tableau de `docs/database/README.md`
- Un ADR décrit une architecture qui n'existe plus

---

## Outils recommandés

### Vérification de liens (à intégrer en CI)

```bash
# Vérifier les liens Markdown cassés
npx markdown-link-check docs/**/*.md
```

### Génération Swagger automatique

En développement, Swagger est généré depuis les décorateurs NestJS :

```typescript
// main.ts
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

Exporter la spec OpenAPI pour une documentation statique :

```bash
npx ts-node -e "/* génération OpenAPI */"
```

---

## Responsabilités

| Qui | Quoi |
|---|---|
| Développeur | Met à jour la doc lors de chaque PR |
| Reviewer | Vérifie la cohérence documentation ↔ code |
| Lead technique | Valide les ADR et la cohérence globale |
| Équipe | Signale les incohérences dès qu'elles sont détectées |

---

## Structure de la documentation à maintenir

```
docs/
├── README.md                   ← Point d'entrée (mise à jour si nouveau module majeur)
├── architecture/
│   ├── README.md               ← Mettre à jour si nouveau module dans app.module.ts
│   └── flows.md                ← Mettre à jour si nouveau flux métier
├── finance/
│   └── *.md                    ← 1 fichier par moteur — mettre à jour si API change
├── api/README.md               ← Mettre à jour à chaque nouvel endpoint
├── database/README.md          ← Mettre à jour à chaque migration
├── business-rules/README.md    ← Mettre à jour si règle change
├── guides/                     ← Mettre à jour si procédure change
├── decisions/                  ← ADR : append only (jamais modifier un ADR accepté)
└── operations/maintenance.md   ← Ce fichier
```
