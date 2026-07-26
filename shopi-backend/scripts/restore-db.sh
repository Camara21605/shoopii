#!/usr/bin/env bash
# ============================================================
# FICHIER : shopi-backend/scripts/restore-db.sh
#
# RÔLE
# ─────────────────────────────────────────────────────────────
# Restauration de la base PostgreSQL depuis un backup compressé.
#
# ⚠️  ATTENTION : Cette opération SUPPRIME la base existante.
#     À n'exécuter qu'après confirmation explicite.
#
# UTILISATION
# ─────────────────────────────────────────────────────────────
#   ./scripts/restore-db.sh ./backups/shopi_20260718_020000.sql.gz
#
# AUTEUR       : Shopi03
# DERNIERE MISE A JOUR : 2026-07-18
# ============================================================

set -euo pipefail

BACKUP_FILE="${1:-}"

# ── Validation ─────────────────────────────────────────────
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Usage: $0 <backup_file.sql.gz>"
  echo "   Exemple: $0 ./backups/shopi_20260718_020000.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Fichier introuvable: $BACKUP_FILE"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL non définie"
  exit 1
fi

# ── Confirmation interactive ───────────────────────────────
echo "══════════════════════════════════════════════════════════"
echo "  ⚠️  RESTAURATION DE BASE DE DONNÉES"
echo "══════════════════════════════════════════════════════════"
echo "  Fichier    : $BACKUP_FILE"
echo "  Taille     : $(du -sh "$BACKUP_FILE" | cut -f1)"
echo "  Destination: ${DATABASE_URL%%@*}@***"
echo ""
echo "  ⚠️  Cette opération va écraser la base de données existante."
echo "  ⚠️  Arrêter l'application avant de continuer."
echo ""
read -p "  Confirmer la restauration ? (oui/non) : " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
  echo "❌ Restauration annulée"
  exit 1
fi

# ── Vérification intégrité ────────────────────────────────
echo "🔍 Vérification de l'intégrité du fichier..."
if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "❌ Fichier corrompu: $BACKUP_FILE"
  exit 1
fi
echo "✅ Intégrité OK"

# ── Restauration ───────────────────────────────────────────
echo "🔄 Restauration en cours: $(date -u '+%Y-%m-%d %H:%M UTC')"

gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --no-password

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Restauration terminée"
echo "  Date    : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""
echo "  Étapes suivantes :"
echo "  1. Vérifier les données critiques (wallets, escrows)"
echo "  2. Exécuter les migrations si nécessaire"
echo "  3. Redémarrer l'application"
echo "  4. Vérifier /health"
echo "══════════════════════════════════════════════════════════"
