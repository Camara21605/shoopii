#!/usr/bin/env bash
# ============================================================
# FICHIER : shopi-backend/scripts/health-check.sh
#
# RÔLE
# ───────────────────────────────���───────────────���─────────────
# Vérification complète de la santé de l'application Shopi.
# Vérifie : API, base de données, Redis, providers de paiement.
#
# UTILISATION
# ─��───────────────────────────────────────────���───────────────
#   ./scripts/health-check.sh                           # Production
#   BASE_URL=http://localhost:3000 ./scripts/health-check.sh  # Local
#
# AUTEUR       : Shopi03
# DERNIERE MISE A JOUR : 2026-07-18
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-https://shopi-backend.onrender.com}"
TIMEOUT=10
PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "000")

  if [ "$STATUS" = "$expected_status" ]; then
    echo "  ✅ $name (HTTP $STATUS)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name (attendu: $expected_status, obtenu: HTTP $STATUS)"
    FAIL=$((FAIL + 1))
  fi
}

check_json() {
  local name="$1"
  local url="$2"
  local expected_key="${3:-status}"
  local expected_val="${4:-ok}"

  BODY=$(curl -s --max-time "$TIMEOUT" "$url" 2>/dev/null || echo "{}")

  if echo "$BODY" | grep -q "\"$expected_key\":\"$expected_val\""; then
    echo "  ✅ $name ($expected_key: $expected_val)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name (clé '$expected_key' absente ou valeur inattendue)"
    echo "     Réponse: $BODY"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "══════════════════════════════════════════════════"
echo "  🔍 Shopi Health Check — $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  🌐 Base URL: $BASE_URL"
echo "══════════════��═══════════════════════════════════"

echo ""
echo "── API principale ────────────────────────────────"
check_json "Health endpoint" "$BASE_URL/health" "status" "ok"
check "Auth endpoint (401 expected)" "$BASE_URL/auth/me" "401"

echo ""
echo "── Endpoints protégés ────────────────────────────"
check "Route sans token (401 expected)" "$BASE_URL/wallet" "401"
check "Route inexistante (404 expected)" "$BASE_URL/route-inexistante-xyz" "404"

echo ""
echo "══════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo "  ✅ RÉSULTAT: Tous les checks passés ($PASS/$((PASS + FAIL)))"
  EXIT_CODE=0
else
  echo "  ❌ RÉSULTAT: $FAIL check(s) échoué(s) / $((PASS + FAIL)) total"
  EXIT_CODE=1
fi
echo "══════════════════════════════════════════════════"
echo ""

exit $EXIT_CODE
