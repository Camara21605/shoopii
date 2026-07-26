# Runbook — Rotation des clés

La rotation des secrets doit être réalisée périodiquement ou immédiatement en cas de compromission suspectée.

---

## Rotation des clés JWT

⚠️ **Impact** : Tous les tokens actifs deviennent invalides. Les utilisateurs devront se reconnecter.

**Planifier pendant une période de faible activité (nuit).**

```bash
# Étape 1 — Générer de nouveaux secrets
NEW_JWT_SECRET=$(openssl rand -base64 64)
NEW_REFRESH_SECRET=$(openssl rand -base64 64)
echo "JWT_SECRET=$NEW_JWT_SECRET"
echo "JWT_REFRESH_SECRET=$NEW_REFRESH_SECRET"

# Étape 2 — Mettre à jour dans Render
# Render Dashboard → Environment Variables → Modifier JWT_SECRET et JWT_REFRESH_SECRET

# Étape 3 — Invalider les refresh tokens existants en DB
# psql $DATABASE_URL_PROD -c "DELETE FROM refresh_token WHERE created_at < NOW();"

# Étape 4 — Redémarrer l'application (Render déploie automatiquement si env vars changées)

# Étape 5 — Vérifier /health
curl https://api.shopi.com/health
```

---

## Rotation de la DATABASE_URL

```bash
# Étape 1 — Créer un nouveau user PostgreSQL avec les mêmes permissions
# (sur le provider DB : Neon, Supabase, etc.)

# Étape 2 — Vérifier la connexion avec le nouveau password
psql "postgres://newuser:newpass@host:5432/shopi_prod" -c "SELECT 1;"

# Étape 3 — Mettre à jour DATABASE_URL dans Render

# Étape 4 — Redémarrer l'application

# Étape 5 — Vérifier /health

# Étape 6 — Supprimer l'ancien user PostgreSQL
```

---

## Rotation des secrets webhook providers

⚠️ **Coordination avec le provider nécessaire.**

1. Générer un nouveau webhook secret dans le dashboard du provider
2. Mettre à jour la variable `ORANGE_MONEY_WEBHOOK_SECRET` (ou autre provider) dans Render
3. Redémarrer l'application
4. Vérifier que les prochains webhooks sont bien validés (logs)

---

## En cas de compromission suspectée

```
IMMÉDIATEMENT :
1. Tourner TOUTES les clés JWT (les tokens compromis deviennent invalides)
2. Tourner DATABASE_URL si la DB est suspectée
3. Invalider les refresh tokens en DB
4. Auditer les logs d'accès des dernières 24h
5. Documenter dans incident-log.md
```

---

## Calendrier de rotation recommandé

| Secret | Fréquence | Prochaine rotation |
|---|---|---|
| `JWT_SECRET` | Trimestrielle | — |
| `JWT_REFRESH_SECRET` | Trimestrielle | — |
| `DATABASE_URL` (password) | Annuelle | — |
| `REDIS_URL` (password) | Annuelle | — |
| Secrets providers paiement | Selon provider | — |
| `CLOUDINARY_API_SECRET` | Annuelle | — |
