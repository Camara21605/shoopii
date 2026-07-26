# Supervision en production

---

## Vue d'ensemble du monitoring

```
┌─────────────────────────────────────────────────┐
│              Stack de monitoring Shopi          │
├──────────────────┬──────────────────────────────┤
│ Disponibilité    │ UptimeRobot (gratuit)         │
│ Logs applicatifs │ Render Logs + Logtail         │
│ Erreurs JS       │ Sentry (plan gratuit)         │
│ Performance API  │ /performance/report (interne) │
│ Alertes          │ Email + Slack webhook         │
└──────────────────┴──────────────────────────────┘
```

---

## 1. Disponibilité — UptimeRobot

**Configurer sur https://uptimerobot.com (gratuit)** :

| Monitor | URL | Interval | Alerte |
|---|---|---|---|
| Backend Health | `https://api.shopi.com/health` | 5 min | Email + Slack |
| Auth Endpoint | `https://api.shopi.com/auth/me` (attendu: 401) | 5 min | Email |

Configuration UptimeRobot :
- Type : HTTP(S)
- Keyword : `"status":"ok"` (pour le health endpoint)
- Alerte si code != 200 pendant 2 vérifications consécutives

---

## 2. Logs — Render + Logtail

### Render Logs (intégré)

```
Render Dashboard → shopi-backend → Logs
```

Filtres utiles :
- Erreurs : `level:error` ou `ERROR`
- Warnings : `level:warn`
- Transactions wallet : `WalletEngine`
- Paiements : `PaymentEngine`

### Logtail (structuré, recommandé)

Installer le transport Logtail dans NestJS :

```typescript
// main.ts
if (process.env.NODE_ENV === 'production' && process.env.LOGTAIL_TOKEN) {
  // Configurer Logtail Winston transport
}
```

Variables requises :
```env
LOGTAIL_TOKEN=your-logtail-token
```

---

## 3. Erreurs — Sentry

### Installation

```bash
npm install @sentry/node  # Demande accord préalable — voir règle "no new deps"
```

Configuration :

```typescript
// src/main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% des transactions
});
```

Variables requises :
```env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

### Alertes Sentry recommandées

- Nouvelle erreur non vue → alerte email immédiate
- Taux d'erreur > 1% en 5 minutes → alerte Slack

---

## 4. Performance — Endpoint interne

```
GET /performance/report   (ADMIN, SUPER_ADMIN)
```

Retourne :
```json
{
  "profiler": { "p95Ms": 145, "errorCount": 2, "requestCount": 1024 },
  "cache": { "hitRate": 0.87 },
  "circuitBreaker": { "state": "CLOSED", "failureCount": 0 }
}
```

Intégrer dans un dashboard Grafana ou consulter manuellement.

---

## 5. Métriques à surveiller

### Métriques applicatives

| Métrique | Seuil normal | Seuil alerte |
|---|---|---|
| P95 temps de réponse | < 500 ms | > 2 000 ms |
| Taux d'erreur 5xx | < 0.1% | > 1% |
| Circuit breaker | CLOSED | OPEN = alerte critique |
| Taux de cache hit | > 70% | < 40% = warning |

### Métriques financières critiques

| Métrique | Vérification |
|---|---|
| Escrows bloqués (LOCKED > 24h) | Quotidienne |
| Wallets FROZEN sans raison connue | Quotidienne |
| Transactions échouées > 5% | Alerte immédiate |
| Soldes négatifs (anomalie) | Alerte immédiate |

### Métriques infrastructure

| Composant | Métrique | Alerte |
|---|---|---|
| PostgreSQL | Connexions > 80% max | Warning |
| Redis | Mémoire > 80% | Warning |
| Render | CPU > 90% pendant 5 min | Warning |
| Render | Mémoire > 85% | Warning |

---

## 6. Tableau de bord opérationnel

Script de vérification quotidienne (à lancer chaque matin) :

```bash
#!/bin/bash
BASE_URL=https://shopi-backend.onrender.com

echo "=== Shopi Daily Check — $(date +%Y-%m-%d) ==="

# Health
echo -n "Health: "
curl -s $BASE_URL/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"

# Performance (avec token admin)
echo -n "Performance P95: "
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" $BASE_URL/performance/report \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['profiler']['p95Ms'],'ms')"

echo "=== OK ==="
```

---

## 7. Alertes configurées

| Canal | Événement |
|---|---|
| Email | Downtime UptimeRobot |
| Email | Nouvelle erreur Sentry |
| Slack | Déploiement réussi/échoué |
| Slack | Circuit breaker OPEN |
| Email | Taux d'erreur > 1% |
