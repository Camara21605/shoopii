# Stratégie de déploiement

---

## Déploiement zéro interruption sur Render

Render déploie par défaut avec une stratégie **rolling** :

1. Nouvelle instance démarrée avec le nouveau code
2. Health check vérifié sur la nouvelle instance (`/health`)
3. Trafic basculé vers la nouvelle instance
4. Ancienne instance arrêtée

L'ancienne instance reste en vie jusqu'à ce que la nouvelle soit opérationnelle → **downtime quasi nul**.

---

## Branches et cibles

| Branch | Cible | Automatique |
|---|---|---|
| `develop` | Staging | ✅ Oui |
| `main` | Production | ✅ Oui |
| `v*.*.*` (tag) | Production (release) | ✅ Oui |
| `feature/*` | — | Non |

---

## Processus de déploiement production

```
1. PR mergée vers main
2. Pipeline deploy-pipeline.yml se déclenche
3. Quality Gate (tests + coverage)
4. Build TypeScript
5. Render deploy hook → nouvelle instance
6. Attente 3 minutes
7. Health check (/health) × 6 essais toutes les 30s
8. Si OK → déploiement confirmé
9. Si KO → alerte + rollback manuel déclenché
```

---

## Migrations de base de données

Les migrations TypeORM doivent être exécutées **avant** le démarrage de la nouvelle instance.

**Option A — Script de démarrage Render** :
```yaml
# render.yaml
startCommand: npm run migration:run && npm run start:prod
```

**Option B — Job séparé avant le déploiement** :
```yaml
# Dans deploy-pipeline.yml
- name: Exécuter les migrations
  run: |
    npx typeorm migration:run -d dist/database/data-source.js
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
```

> **Règle** : Les migrations doivent être **backward compatible** — la version N du code doit fonctionner avec le schéma N et N+1.

---

## Rollback

### Rollback immédiat sur Render

1. Render Dashboard → shopi-backend → Deploys
2. Trouver le dernier déploiement réussi
3. Cliquer "Rollback to this deploy"
4. Vérifier le health check

**Délai estimé** : 2–5 minutes

### Rollback manuel via Git

```bash
# Identifier le dernier tag stable
git tag --sort=-creatordate | head -5

# Créer un tag de revert
git checkout <commit-stable>
git tag v<version>-revert
git push origin v<version>-revert
# → Déclenche le pipeline de déploiement
```

---

## Vérifications post-déploiement

Checklist à exécuter manuellement après chaque déploiement production :

- [ ] `GET /health` → `{ "status": "ok" }`
- [ ] `POST /auth/login` avec des credentials invalides → `401`
- [ ] `GET /` → pas de 500
- [ ] Vérifier les logs Render (0 erreur critique dans les 5 premières minutes)
- [ ] Vérifier le dashboard Render (CPU, mémoire — pas de pic anormal)

---

## Déploiement d'urgence (hotfix)

```
1. Créer une branch 'hotfix/description' depuis main
2. Corriger le problème
3. Tester localement
4. PR vers main avec label [URGENT]
5. Review + merge rapide
6. Déploiement automatique
7. Documenter l'incident dans docs/operations/incident-log.md
```
