# Runbook — Démarrage du système

Ce runbook décrit les étapes pour démarrer Shopi Backend en production.

---

## Démarrage standard (Render)

Render démarre automatiquement l'application après déploiement. Pour un démarrage manuel :

1. Render Dashboard → shopi-backend
2. Cliquer sur "Resume" si l'instance était suspendue
3. Attendre le health check vert (2–3 minutes)
4. Vérifier : `curl https://api.shopi.com/health`

---

## Démarrage local (développement)

```bash
cd shopi-backend

# 1. Vérifier que PostgreSQL et Redis sont actifs
pg_isready -d shopi_dev
redis-cli ping   # → PONG

# 2. Vérifier le fichier .env
ls -la .env

# 3. Exécuter les migrations
npm run migration:run

# 4. Démarrer l'application
npm run start:dev   # Watch mode
# ou
npm run start:prod  # Comme en production
```

---

## Ordre de démarrage des services

```
1. PostgreSQL     → doit être opérationnel AVANT le backend
2. Redis          → doit être opérationnel AVANT le backend (lazyConnect tolère un démarrage tardif)
3. Backend NestJS → démarre en dernier
4. Vérification  → /health
```

---

## Vérifications post-démarrage

```bash
# Health check complet
./scripts/health-check.sh

# Vérifier les logs (0 erreur de démarrage)
# Sur Render : Dashboard → Logs
# En local :
npm run start:prod 2>&1 | grep -E "ERROR|WARN|started on port"
```

---

## Indicateurs de démarrage réussi

Chercher dans les logs :
```
[NestFactory] Starting Nest application...
[NestApplication] Nest application successfully started
Application is running on: http://localhost:3000
```

Aucun de ces messages en rouge :
- `TypeOrmModule dependencies not found`
- `ioredis ECONNREFUSED`
- `JWT_SECRET is not defined`
