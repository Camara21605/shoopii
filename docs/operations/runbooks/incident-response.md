# Runbook — Réponse aux incidents

---

## Classification rapide

| Sévérité | Critères | Délai de réponse |
|---|---|---|
| **P0** | API totalement indisponible, wallets bloqués, fonds inaccessibles | Immédiat (< 15 min) |
| **P1** | Paiements impossibles, escrows bloqués, 50%+ des utilisateurs impactés | < 30 min |
| **P2** | Fonctionnalité dégradée, erreurs sporadiques (< 10%), lenteurs | < 2h |
| **P3** | Bug mineur, question utilisateur, amélioration | < 24h |

---

## P0 — API totalement indisponible

```
DÉTECTION : UptimeRobot alerte + /health ne répond pas

ACTIONS IMMÉDIATES (dans cet ordre) :
1. Vérifier render.com/status — panne globale Render ?
   → OUI : attendre (généralement < 1h), communiquer
   → NON : continuer

2. Render Dashboard → shopi-backend → Logs
   → Chercher : ERROR, FATAL, ECONNREFUSED, OUT_OF_MEMORY

3. Identifier la cause :
   a. "TypeOrmModule" → Base de données inaccessible
   b. "ioredis" → Redis inaccessible (non bloquant, mode dégradé)
   c. "JWT_SECRET is not defined" → Variable d'environnement manquante
   d. "Cannot find module" → Build cassé
   e. "FATAL out of memory" → Crash mémoire, redémarrer

4. Selon la cause, appliquer le correctif puis :
   Render Dashboard → Manual Deploy (même commit)

5. Vérifier : curl https://api.shopi.com/health

6. Documenter dans incident-log.md
```

---

## P1 — Paiements impossibles

```
DÉTECTION : Erreurs dans logs PaymentEngine, alertes utilisateurs

DIAGNOSTIC :
1. Identifier le provider KO :
   grep "PaymentEngine" logs | grep ERROR
   grep "ORANGE_MONEY|MTN_MOMO" logs | grep -i fail

2. Tester le provider manuellement (endpoint de test du provider)

3. Vérifier les variables d'environnement du provider :
   ORANGE_MONEY_BASE_URL, ORANGE_MONEY_API_KEY, etc.

4. Si provider externe KO :
   → Contacter le support du provider
   → Communiquer aux utilisateurs
   → Proposer un provider alternatif si disponible

5. Si config Shopi en cause :
   → Corriger la variable d'environnement dans Render
   → Redéployer

6. Après résolution : vérifier les transactions PENDING
   SELECT * FROM paiement WHERE status='PENDING' ORDER BY created_at;
```

---

## P1 — Wallets bloqués / soldes anormaux

```
DIAGNOSTIC :
1. Identifier les wallets en anomalie :
   SELECT id, user_id, balance, escrow_balance, status
   FROM wallet
   WHERE balance < 0 OR status NOT IN ('ACTIVE','SUSPENDED');

2. Identifier les transactions bloquées :
   SELECT * FROM wallet_transaction WHERE status='PENDING'
   AND created_at < NOW() - INTERVAL '1 hour';

3. Actions SUPER_ADMIN via dashboard :
   - Consulter le wallet concerné
   - Visualiser l'historique des opérations
   - Si nécessaire : correction manuelle (avec double validation)

4. IMPORTANT : Toute correction manuelle doit être journalisée
   (qui, quoi, pourquoi, montant avant/après)
```

---

## P1 — Escrows bloqués

```
DÉTECTION : SELECT COUNT(*) FROM escrow WHERE status='LOCKED'
            AND updated_at < NOW() - INTERVAL '24 hours';

DIAGNOSTIC :
1. Vérifier les escrows concernés :
   SELECT id, commande_id, amount, status, created_at
   FROM escrow WHERE status='LOCKED'
   AND updated_at < NOW() - INTERVAL '24 hours';

2. Identifier pourquoi la validation n'a pas eu lieu :
   - Commande validée mais escrow non transitionné ?
   - Problème de webhooks de validation ?

3. Actions :
   a. Vérifier le statut de la commande associée
   b. Si commande validée côté vendeur : déclencher le release manuellement
   c. Si litige : créer un ticket dans ResolutionEngine

4. Communiquer aux vendeurs concernés si délai > 48h
```

---

## P2 — Lenteurs API

```
DÉTECTION : Temps de réponse P95 > 500ms (Render Logs, Logtail)

DIAGNOSTIC :
1. Identifier les endpoints lents :
   grep "ms" logs | awk '$NF > 500' | sort -k NF -n | tail -20

2. Vérifier la charge DB :
   SELECT pid, query, query_start, state
   FROM pg_stat_activity WHERE state='active';

3. Vérifier Redis (cache miss rate) :
   redis-cli -u $REDIS_URL info stats | grep -E "hits|misses"

4. Vérifier si circuit breaker ouvert :
   curl https://api.shopi.com/performance/report

5. Actions courantes :
   - Trop de cache misses → vérifier TTL des clés
   - Requêtes DB lentes → EXPLAIN ANALYZE sur la requête
   - Circuit breaker ouvert → identifier le service défaillant
```

---

## Post-incident — Template post-mortem

```markdown
## Post-mortem : [Titre de l'incident]

**Date** : YYYY-MM-DD
**Durée** : HH:MM – HH:MM (X minutes)
**Sévérité** : P0/P1/P2

### Chronologie
- HH:MM — Détection
- HH:MM — Premier diagnostic
- HH:MM — Cause identifiée
- HH:MM — Correctif appliqué
- HH:MM — Résolution confirmée

### Cause racine
[Description précise]

### Impact
- Utilisateurs affectés : [nombre/pourcentage]
- Fonctionnalités impactées : [liste]
- Pertes estimées : [si applicable]

### Correctifs appliqués
[Description des actions]

### Actions préventives
- [ ] [Action 1] — Responsable : XXX — Échéance : YYYY-MM-DD
- [ ] [Action 2] — Responsable : XXX — Échéance : YYYY-MM-DD
```
