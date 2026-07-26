#!/usr/bin/env bash
# ============================================================
# FICHIER : shopi-backend/scripts/backup-db.sh
#
# RÔLE
# ─────────────────────────────────────────────────────────────
# Sauvegarde complète de la base de données PostgreSQL Shopi.
# Crée un dump compressé (pg_dump + gzip) horodaté.
#
# UTILISATION
# ─────────────────────────────────────────────────────────────
#   ./scripts/backup-db.sh                    # Manuel
#   BACKUP_DIR=/backups ./scripts/backup-db.sh  # Répertoire custom
#
# VARIABLES D'ENVIRONNEMENT
# ─────────────────────────────────────────────────────────────
#   DATABASE_URL   — URL PostgreSQL complète (requis)
#   BACKUP_DIR     — Répertoire de destination (défaut: ./backups)
#   RETENTION_DAYS — Jours de rétention (défaut: 30)
#
# CRON (exemple — tous les jours à 2h00)
# ─────────────────────────────────────────────────────────────
#   0 2 * * * /path/to/shopi-backend/scripts/backup-db.sh >> /var/log/shopi-backup.log 2>&1
#
# AUTEUR       : Shopi03
# DERNIERE MISE A JOUR : 2026-07-18
# ============================================================

set -euo pipefail

# ── Configuration ──────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/shopi_${TIMESTAMP}.sql.gz"

# ── Validation ─────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ Erreur: DATABASE_URL non définie"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "❌ Erreur: pg_dump non installé"
  exit 1
fi

# ── Création du répertoire ─────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Sauvegarde ─────────────────────────────────────────────
echo "🔄 Démarrage de la sauvegarde: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "📁 Destination: $BACKUP_FILE"

pg_dump "$DATABASE_URL" \
  --verbose \
  --no-password \
  --format=plain \
  --blobs \
  --no-acl \
  --no-owner \
  | gzip > "$BACKUP_FILE"

# ── Vérification ───────────────────────────────────────────
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
  echo "✅ Sauvegarde réussie: $BACKUP_FILE ($SIZE)"
else
  echo "❌ Échec: fichier de sauvegarde vide ou manquant"
  exit 1
fi

# ── Vérification d'intégrité rapide ────────────────────────
if gunzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "✅ Intégrité gzip vérifiée"
else
  echo "❌ Fichier gzip corrompu: $BACKUP_FILE"
  exit 1
fi

# ── Nettoyage des anciennes sauvegardes ────────────────────
echo "🧹 Nettoyage des sauvegardes de plus de $RETENTION_DAYS jours..."
DELETED=$(find "$BACKUP_DIR" -name "shopi_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
echo "   $DELETED fichier(s) supprimé(s)"

# ── Résumé ─────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════"
echo "  Sauvegarde terminée"
echo "  Fichier : $(basename "$BACKUP_FILE")"
echo "  Taille  : $SIZE"
echo "  Date    : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "══════════════════════════════════════"
