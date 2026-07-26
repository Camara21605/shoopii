# Stratégie de sauvegarde

---

## PostgreSQL — Base de données principale

### Sauvegarde automatique

**Si hébergé sur Render/Neon/Supabase** : sauvegardes automatiques quotidiennes incluses dans le plan (conserver au minimum 7 jours).

**Sauvegarde manuelle complémentaire** (via cron ou GitHub Actions) :

```bash
# Via script
cd shopi-backend
DATABASE_URL=$DATABASE_URL_PROD \
BACKUP_DIR=/secure/backups \
RETENTION_DAYS=30 \
./scripts/backup-db.sh
```

### Stratégie de rétention

| Fréquence | Rétention |
|---|---|
| Quotidienne (automatique) | 30 jours |
| Hebdomadaire (manuelle) | 90 jours |
| Mensuelle (manuelle) | 1 an |

### Sauvegarde mensuelle via GitHub Actions

```yaml
# .github/workflows/backup.yml (à créer)
on:
  schedule:
    - cron: '0 2 1 * *'   # 1er du mois à 2h00

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          pg_dump "$DATABASE_URL_PROD" | gzip > backup_$(date +%Y%m).sql.gz
        env:
          DATABASE_URL_PROD: ${{ secrets.DATABASE_URL_PROD }}
      - uses: actions/upload-artifact@v4
        with:
          name: monthly-backup-${{ github.run_id }}
          path: '*.sql.gz'
          retention-days: 365
```

---

## Redis — Cache et queues

Redis est **volatile** par conception. En cas de perte :
- **Cache** : se reconstruit automatiquement au premier accès (Cache-Aside)
- **Queues BullMQ** : les jobs en cours peuvent être perdus → prévoir une procédure de relance manuelle

**Si persistence Redis souhaitée** : activer AOF dans la config Redis :
```
appendonly yes
appendfsync everysec
```

---

## Cloudinary — Fichiers uploadés

- Cloudinary conserve les fichiers indéfiniment par défaut
- Pas de sauvegarde additionnelle nécessaire sauf exigence de portabilité
- En cas de migration : utiliser l'API Cloudinary pour exporter tous les assets

---

## Configurations

Les configurations applicatives doivent être versionnées dans Git :
- `render.yaml` ✅
- `.github/workflows/` ✅
- Fichiers d'environnement `.env.example` ✅

---

## Procédure de restauration PostgreSQL

```bash
# 1. Arrêter l'application (Render Dashboard → Suspend)
# 2. Restaurer la base
DATABASE_URL=$DATABASE_URL_PROD \
./shopi-backend/scripts/restore-db.sh ./backups/shopi_20260718.sql.gz

# 3. Vérifier les données critiques
psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM wallet WHERE status='ACTIVE';"
psql $DATABASE_URL_PROD -c "SELECT COUNT(*) FROM escrow WHERE status NOT IN ('RELEASED','REFUNDED','FAILED','EXPIRED');"

# 4. Exécuter les migrations manquantes si nécessaire
cd shopi-backend && npm run migration:run

# 5. Redémarrer l'application
# 6. Vérifier /health
```

---

## Tests de restauration

**Fréquence recommandée** : Mensuelle sur environnement staging

```bash
# Sur staging uniquement
DATABASE_URL=$DATABASE_URL_STAGING \
./shopi-backend/scripts/restore-db.sh <dernier_backup_prod_anonymisé>
```

> Toujours tester la restauration sur staging — jamais directement en production.
