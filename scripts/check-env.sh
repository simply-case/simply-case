#!/usr/bin/env bash
# Validates apps/web/.env.local without ever printing a credential value.
# Usage: bash scripts/check-env.sh
set -uo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="apps/web/.env.local"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE"; exit 1; }
set -a; . "./$ENV_FILE"; set +a

fail=0

# Report presence/shape only. Never interpolate a secret into output:
# "${VAR:+set}" is safe, "${VAR:-...}" is NOT (it echoes the value).
check_shape() {
  local name="$1" prefix="$2" value="${!1-}"
  if [ -z "$value" ]; then
    printf '  %-38s MISSING\n' "$name"; fail=1
  elif [ "${value#"$prefix"}" = "$value" ]; then
    printf '  %-38s wrong prefix (expected %s)\n' "$name" "$prefix"; fail=1
  else
    printf '  %-38s ok (%s…, %d chars)\n' "$name" "$prefix" "${#value}"
  fi
}

echo "shape:"
check_shape NEXT_PUBLIC_SUPABASE_URL             "https://"
check_shape NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "sb_publishable_"
check_shape SUPABASE_SECRET_KEY                  "sb_secret_"

echo "live:"
u="${NEXT_PUBLIC_SUPABASE_URL:-}"
probe() {
  local label="$1" code
  code=$(curl -s -m 10 -o /dev/null -w '%{http_code}' "${@:2}")
  printf '  %-38s HTTP %s\n' "$label" "$code"
  [ "$code" = "200" ] || fail=1
}
# /auth/v1/settings accepts the publishable key; /rest/v1/ root requires a secret key.
probe "publishable key" "$u/auth/v1/settings" -H "apikey: ${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}"
probe "secret key"      "$u/rest/v1/"         -H "apikey: ${SUPABASE_SECRET_KEY:-}" \
                                              -H "Authorization: Bearer ${SUPABASE_SECRET_KEY:-}"

[ "$fail" -eq 0 ] && echo "all checks passed" || echo "FAILED"
exit "$fail"
