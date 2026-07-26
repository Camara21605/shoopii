# Runbook — Sauvegarde et restauration

---

## Créer un backup manuel

```bash
# Prérequis : DATABASE_URL_PROD défini dans l'environnement
export DATABASE_URL="postgres://user:pass@host:5432/shopi_prod"

cd shopi-backend
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

Le fichier est enregistré dans `backups/shopi_prod_YYYYMMDD_HHMMSS.sql.gz`.

---

## Vérifier un backup existant

```bash
# Vérifier l'intégrité du fichier gzip
gzip -t backups/shopi_prod_20260718_020000.sql.gz && echo "OK" || echo "CORROMPU"

# Voir la taille du fichier (doit être > quelques Ko)
ls -lh backups/shopi_prod_*.sql.gz

# Inspecter les premières lignes sans décompresser entièrement
gunzip -c backups/shopi_prod_20260718_020000.sql.gz | head -20
```

---

## Restaurer un backup

⚠️ **Cette opération écrase la base de données cible.**
⚠️ **Ne JAMAIS restaurer directement en production sans test préalable sur staging.**

### Étape 1 — Tester sur staging

```bash
export DATABASE_URL="postgres://user:pass@host:5432/shopi_staging"
./scripts/restore-db.sh backups/shopi_prod_20260718_020000.sql.gz
```

Vérifier que l'application staging démarre correctement.

### Étape 2 — Restaurer en production (si nécessaire)

```bash
# 1. Arrêter l'application (Render → Suspend Service)
# 2. Créer un backup de la DB courante (même corrompue)
export DATABASE_URL="$DATABASE_URL_PROD"
./scripts/backup-db.sh

# 3. Lancer la restauration
./scripts/restore-db.sh backups/BACKUP_A_RESTAURER.sql.gz

# 4. Vérifications post-restauration
psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM wallet WHERE status='ACTIVE';"
psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM commande;"
psql $DATABASE_URL_PROD -c "SELECT SUM(balance) FROM wallet;"

# 5. Relancer l'application (Render → Resume)

# 6. Vérifier /health
curl https://api.shopi.com/health
```

---

## Tester les backups mensuellement

```bash
# Script de test de restauration sur staging
export DATABASE_URL="$DATABASE_URL_STAGING"
LATEST_BACKUP=$(ls -t backups/*.sql.gz | head -1)
echo "Test restauration : $LATEST_BACKUP"
./scripts/restore-db.sh "$LATEST_BACKUP"
echo "Test terminé : vérifier que staging répond correctement"
```

---

## Sauvegarde des configurations

Les configurations importantes sont déjà en Git. Vérifier que les fichiers suivants sont commités :

```
render.yaml
shopi-backend/.env.example
.github/workflows/
docs/operations/
```

---

## Localisation des backups

| Environnement | Emplacement |
|---|---|
| Automatique (Render) | Dashboard Render → Database → Backups |
| Manuel (script) | `shopi-backend/backups/` (local) |
| À archiver | Copier vers un stockage externe (Cloudinary, S3, Google Drive) |
