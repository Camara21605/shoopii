# Audit Final — État de production readiness

Date : 2026-07-18

---

## Résumé exécutif

| Domaine | État | Risque |
|---|---|---|
| Code backend | ✅ Solide | Faible |
| Tests | ✅ ~180 tests, CI actif | Faible |
| Base de données | ✅ Migrations TypeORM | Moyen |
| Redis | ✅ Configuré | Moyen |
| Sécurité JWT/RBAC | ✅ Validé par tests | Faible |
| Déploiement Render | ✅ render.yaml présent | Faible |
| Sauvegardes | ❌ Pas de stratégie | Élevé |
| Monitoring | ❌ Pas d'alertes | Élevé |
| Plan de reprise | ❌ Inexistant | Élevé |
| Rotation des secrets | ❌ Pas documentée | Moyen |
| Tests de charge | ❌ Non réalisés | Moyen |

---

## Inventaire des composants critiques

### Backend NestJS
- **Runtime** : Node.js 20 LTS
- **Framework** : NestJS 11
- **Port** : 3000 (configurable via `PORT`)
- **Health check** : `GET /health` → `{ status, timestamp, environment, version }`
- **Risque** : Pas de health check actif sur DB/Redis — endpoint répond même si PostgreSQL est KO

### Base de données PostgreSQL
- **ORM** : TypeORM, `synchronize: false` ✅
- **Migrations** : 12 fichiers versionnés ✅
- **Connexion** : `DATABASE_URL` (SSL en production) ✅
- **Risque** : Pas de pool de connexions configuré explicitement
- **Risque** : Pas de sauvegarde automatique documentée ❌

### Redis
- **Client** : ioredis avec `lazyConnect: true` ✅
- **Usage** : Cache, BullMQ, sessions
- **Risque** : Perte de données en cas de redémarrage (cache volatil — acceptable) ✅
- **Risque** : Pas de configuration de persistence (AOF/RDB) documentée

### Stockage fichiers — Cloudinary
- **Usage** : Uploads (support tickets, produits)
- **Risque** : Dépendance externe — pas de fallback local documenté

### Providers de paiement
- **Orange Money, MTN, Wave, Djomy, Moov, Bancaire**
- **Risque** : Pas de circuit breaker sur les appels providers (mitigation : PerformanceEngine)
- **Risque** : Webhooks : validation de signature implémentée ✅

### Wallets & Escrow
- **Verrou pessimiste** : `SELECT FOR UPDATE` ✅
- **Idempotence** : Clé unique sur `wallet_transaction` ✅
- **Risque** : Timeout de verrou en cas de contention élevée → à monitorer

### Sécurité
- **JWT double token** ✅
- **Rate limiting** : 60 req/min/IP ✅
- **OWASP Top 10** : Testé ✅
- **RBAC** : Guards + tests ✅
- **Risque** : Headers de sécurité Helmet non confirmés en production

---

## Points bloquants avant production

### Priorité CRITIQUE

1. **Sauvegarde PostgreSQL** — Aucune procédure automatique
2. **Monitoring + alertes** — Aucune visibilité en production
3. **Health check actif** — `/health` ne vérifie pas DB/Redis
4. **Plan de reprise** — Pas documenté

### Priorité HAUTE

5. **Variables d'environnement** — `JWT_REFRESH_SECRET` absent de `render.yaml`
6. **Rotation des secrets** — Pas de procédure documentée
7. **Tests de charge** — Performances inconnues sous charge réelle
8. **Helmet** — Headers sécurité à confirmer activés en production

### Priorité MOYENNE

9. **Pool de connexions PostgreSQL** — Configurer `max` explicitement
10. **Logging structuré** — Logs non formatés JSON (difficile à parser en production)
11. **Limites des payloads** — `bodyParser limit` non configuré explicitement
12. **CORS strict** — `CORS_ORIGIN` à restreindre aux domaines connus

---

## Dépendances critiques externes

| Service | Criticité | Fallback disponible |
|---|---|---|
| PostgreSQL | Bloquant | Non — point de défaillance unique |
| Redis | Important | Dégradé (cache miss, queues arrêtées) |
| Cloudinary | Important | Non — uploads impossibles sans Cloudinary |
| Providers paiement | Bloquant | Partiel — un provider KO ne bloque pas les autres |
| SMTP (email) | Important | Non — notifications email silencieuses |
| Render (hébergement) | Bloquant | Non — migrer vers VPS en cas de problème Render |
