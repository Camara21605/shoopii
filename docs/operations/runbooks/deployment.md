# Runbook — Déploiement

---

## Déploiement standard (automatique)

Le déploiement se déclenche automatiquement via GitHub Actions.

```
push vers develop → deploy-pipeline.yml → staging
push vers main   → deploy-pipeline.yml → production
tag v*.*.*       → deploy-pipeline.yml → production
```

Suivre le déploiement : GitHub → Actions → deploy-pipeline.yml

---

## Déploiement manuel d'urgence

Si le pipeline CI est cassé et qu'un fix urgent doit passer en production :

```bash
# Depuis Render Dashboard :
# 1. Manual Deploy → sélectionner le commit cible
# 2. Confirmer

# Ou via l'API Render :
curl -X POST \
  "https://api.render.com/deploy/$RENDER_SERVICE_ID?key=$RENDER_API_KEY"
```

---

## Déploiement d'une migration seule

Si seules des migrations doivent être appliquées (sans nouveau code) :

```bash
# Sur un serveur avec accès à DATABASE_URL_PROD
cd shopi-backend
NODE_ENV=production \
DATABASE_URL=$DATABASE_URL_PROD \
npm run migration:run
```

---

## Rollback en 5 minutes

```
1. Render Dashboard → shopi-backend → Deploys
2. Trouver le dernier déploiement en état "Live" (avant le problème)
3. Cliquer sur les "..." → "Rollback to this deploy"
4. Attendre 2–3 minutes
5. Vérifier : curl https://api.shopi.com/health
```

---

## Checklist avant déploiement production

- [ ] Tests CI verts sur la PR
- [ ] Backup DB réalisé (si migration incluse)
- [ ] Migrations testées sur staging
- [ ] Fenêtre de déploiement communiquée (si maintenance prévue)

---

## Post-déploiement

```bash
# Vérification immédiate (automatisée par CI)
curl https://api.shopi.com/health

# Vérification manuelle des logs (5 premières minutes)
# Render Dashboard → Logs → filtrer par "ERROR"

# Si tout est OK : déploiement confirmé
# Si erreur → rollback immédiat
```
