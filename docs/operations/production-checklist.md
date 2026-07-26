# Checklist de mise en production

> Cette checklist doit être complétée intégralement avant toute mise en production.  
> **Aucune dérogation autorisée sur les items critiques (🔴).**

---

## 1. Qualité du code

- [ ] 🔴 Tests CI verts (`quality-gate` GitHub Actions)
- [ ] 🔴 Coverage > 70% lignes (60% branches)
- [ ] 🔴 Lint : zéro erreur (`npm run lint`)
- [ ] 🔴 TypeCheck : zéro erreur (`npx tsc --noEmit`)
- [ ] 🟡 Revue de code par au moins 1 relecteur
- [ ] 🟡 Tests de sécurité RBAC + injections verts

## 2. Base de données

- [ ] 🔴 Migrations testées sur staging (sans erreur)
- [ ] 🔴 Migrations backward compatible (N-1 code compatible avec schéma N)
- [ ] 🔴 `synchronize: false` confirmé en production
- [ ] 🟡 Backup de la DB production réalisé avant déploiement
- [ ] 🟡 Procédure de rollback de migration documentée

## 3. Variables d'environnement

- [ ] 🔴 Toutes les variables de `render.yaml` (sync: false) renseignées dans Render
- [ ] 🔴 `JWT_SECRET` généré aléatoirement (≥ 32 chars)
- [ ] 🔴 `JWT_REFRESH_SECRET` différent de `JWT_SECRET`
- [ ] 🔴 `DATABASE_URL` avec `DB_SSL=true`
- [ ] 🔴 `SUPER_ADMIN_PASSWORD` complexe (à changer après premier login)
- [ ] 🟡 Secrets providers de paiement configurés (mode LIVE)
- [ ] 🟡 `CLOUDINARY_*` configuré
- [ ] 🟡 `SMTP_*` configuré avec adresse réelle

## 4. Sécurité

- [ ] 🔴 Aucune clé sensible dans le code source
- [ ] 🔴 `.env` dans `.gitignore`
- [ ] 🔴 CORS restreint aux domaines de production (`CORS_ORIGIN=https://shopi.com`)
- [ ] 🔴 HTTPS activé (Render le force automatiquement)
- [ ] 🟡 Headers Helmet configurés
- [ ] 🟡 Audit npm : `npm audit --audit-level=high` (0 vulnérabilité HIGH)
- [ ] 🟡 Rate limiting : 60 req/min vérifié

## 5. Performances

- [ ] 🟡 Tests de charge basiques réalisés sur staging (ex: Artillery, k6)
- [ ] 🟡 P95 < 500 ms sur les endpoints critiques (auth, wallet, commande)
- [ ] 🟡 Index PostgreSQL vérifiés pour les requêtes fréquentes
- [ ] 🟡 Circuit breaker configuré et testé

## 6. Monitoring et alertes

- [ ] 🔴 UptimeRobot configuré sur `/health`
- [ ] 🟡 Sentry configuré (DSN en variable d'environnement)
- [ ] 🟡 Alerte Slack ou email en cas de downtime
- [ ] 🟡 Logs structurés accessibles (Render Logs ou Logtail)

## 7. Sauvegardes

- [ ] 🔴 Backup automatique PostgreSQL activé (provider ou script cron)
- [ ] 🔴 Procédure de restauration documentée et testée sur staging
- [ ] 🟡 Rétention des backups ≥ 30 jours

## 8. Documentation

- [ ] 🔴 `docs/deployment/README.md` à jour
- [ ] 🟡 Runbooks opérationnels à jour (`docs/operations/runbooks/`)
- [ ] 🟡 Procédure de rollback documentée
- [ ] 🟡 Contacts d'urgence à jour (`docs/operations/disaster-recovery.md`)

## 9. Déploiement

- [ ] 🔴 render.yaml valide et à jour
- [ ] 🔴 Health check Render configuré (`/health`)
- [ ] 🟡 Migrations intégrées au `startCommand`
- [ ] 🟡 `APP_VERSION` = tag Git injecté en CI

## 10. Vérifications post-déploiement

- [ ] 🔴 `GET /health` → `{ "status": "ok" }`
- [ ] 🔴 `POST /auth/login` (credentials invalides) → `401`
- [ ] 🔴 Logs Render : 0 erreur critique dans les 5 premières minutes
- [ ] 🟡 Test de création de commande en staging
- [ ] 🟡 Test de paiement en mode sandbox
- [ ] 🟡 Dashboard admin accessible

## 11. Conformité et données

- [ ] 🔴 Aucune donnée de production en staging/dev
- [ ] 🔴 SUPER_ADMIN_PASSWORD changé après premier login
- [ ] 🟡 Politique de rétention des logs définie (RGPD si applicable)
- [ ] 🟡 Données sensibles non loguées (passwords, tokens, cartes)

---

## Signature et validation

```
Checklist complétée par : _____________________
Date                     : _____________________
Déploiement autorisé     : ☐ OUI  ☐ NON

Blocages identifiés :
_________________________________________________
```

---

## Légende

| Icône | Signification |
|---|---|
| 🔴 | Critique — bloquant pour la mise en production |
| 🟡 | Important — à résoudre rapidement après production |
