#!/bin/sh
set -e

# Easypanel costuma enviar VITE_* (Site) ou EXPO_PUBLIC_* (App) só em runtime
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-${VITE_SUPABASE_URL:-}}"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-${VITE_SUPABASE_ANON_KEY:-}}"
export EXPO_PUBLIC_MEI_API_URL="${EXPO_PUBLIC_MEI_API_URL:-${VITE_API_URL:-}}"
export EXPO_PUBLIC_APP_PRODUCT="${EXPO_PUBLIC_APP_PRODUCT:-focomei}"
export EXPO_PUBLIC_AUTH_MODE="${EXPO_PUBLIC_AUTH_MODE:-}"
export EXPO_PUBLIC_INVITE_APP_BASE_URL="${EXPO_PUBLIC_INVITE_APP_BASE_URL:-}"

HTML_ROOT="/usr/share/nginx/html"
ENV_JS="${HTML_ROOT}/env-config.js"

# Escapa aspas duplas para JSON
escape_json() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

URL_ESC=$(escape_json "$EXPO_PUBLIC_SUPABASE_URL")
KEY_ESC=$(escape_json "$EXPO_PUBLIC_SUPABASE_ANON_KEY")
API_ESC=$(escape_json "$EXPO_PUBLIC_MEI_API_URL")
BASE_ESC=$(escape_json "${EXPO_PUBLIC_INVITE_APP_BASE_URL:-}")
PRODUCT_ESC=$(escape_json "${EXPO_PUBLIC_APP_PRODUCT:-}")
AUTH_MODE_ESC=$(escape_json "${EXPO_PUBLIC_AUTH_MODE:-}")

cat > "$ENV_JS" <<EOF
window.__MEU_FINANCEIRO_ENV__ = {
  "EXPO_PUBLIC_SUPABASE_URL": "${URL_ESC}",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "${KEY_ESC}",
  "EXPO_PUBLIC_MEI_API_URL": "${API_ESC}",
  "EXPO_PUBLIC_INVITE_APP_BASE_URL": "${BASE_ESC}",
  "EXPO_PUBLIC_APP_PRODUCT": "${PRODUCT_ESC}",
  "EXPO_PUBLIC_AUTH_MODE": "${AUTH_MODE_ESC}"
};
EOF

# Injeta env-config ANTES dos bundles (Expo pode usar <head> com atributos)
INDEX="${HTML_ROOT}/index.html"
if [ -f "$INDEX" ] && ! grep -q 'env-config.js' "$INDEX"; then
  sed -i 's|<head>|<head><script src="/env-config.js"></script>|' "$INDEX" 2>/dev/null || true
  if ! grep -q 'env-config.js' "$INDEX"; then
    sed -i 's|<head |<head><script src="/env-config.js"></script><head |' "$INDEX" 2>/dev/null || true
  fi
  if ! grep -q 'env-config.js' "$INDEX"; then
    sed -i 's|</head>|<script src="/env-config.js"></script></head>|' "$INDEX" 2>/dev/null || true
  fi
  if ! grep -q 'env-config.js' "$INDEX"; then
    sed -i '0,/<script/{s|<script|<script src="/env-config.js"></script><script|}' "$INDEX" 2>/dev/null || true
  fi
fi

AUTH_MODE_NORM=$(printf '%s' "${EXPO_PUBLIC_AUTH_MODE:-}" | tr '[:upper:]' '[:lower:]')
if [ "$AUTH_MODE_NORM" = "local" ]; then
  echo "OK: EXPO_PUBLIC_AUTH_MODE=local (Auth via API; Supabase Auth opcional)."
  if [ -z "$EXPO_PUBLIC_MEI_API_URL" ]; then
    echo "AVISO: EXPO_PUBLIC_MEI_API_URL vazio com AUTH_MODE=local."
  fi
elif [ -z "$EXPO_PUBLIC_SUPABASE_URL" ] || [ -z "$EXPO_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "AVISO: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY vazios."
  echo "  Defina no Easypanel (Environment) ou como Build Arguments."
  echo "  Aceita também VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  echo "  Ou use EXPO_PUBLIC_AUTH_MODE=local + EXPO_PUBLIC_MEI_API_URL."
fi

exec nginx -g 'daemon off;'
