# Déploiement — Guide

## Prérequis

- Node.js 20 LTS
- PostgreSQL 15
- Redis 7
- Variables d'environnement configurées (voir [guides/environment.md](../guides/environment.md))

---

## Build

```bash
cd shopi-backend
npm ci --omit=dev
npm run build
# → dist/ contient le JS compilé
```

---

## Migrations (toujours avant le démarrage)

```bash
NODE_ENV=production npm run migration:run
```

> Ne jamais utiliser `synchronize: true` en production.

---

## Démarrage

```bash
NODE_ENV=production node dist/main.js
# Ou avec PM2 :
pm2 start dist/main.js --name shopi-backend
```

---

## GitHub Actions — Pipeline QA

Avant tout déploiement, le pipeline CI vérifie :

1. Lint + TypeCheck
2. Tests unitaires + Coverage Gate
3. Tests d'intégration
4. Tests de sécurité (RBAC + injections)
5. Build TypeScript
6. Audit dépendances npm

**Le déploiement est bloqué si un job échoue.**

Voir `.github/workflows/qa-pipeline.yml`.

---

## Checklist de déploiement

- [ ] Variables d'environnement mises à jour sur le serveur
- [ ] Migrations exécutées
- [ ] Redis disponible et accessible
- [ ] Tests CI verts
- [ ] Endpoint `/health` répond `{ "status": "ok" }`
- [ ] Vérifier les logs d'erreur dans les premières minutes
