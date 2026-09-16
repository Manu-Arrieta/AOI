#!/usr/bin/env bash
# session-close-hook.sh — Stop hook for AOI agentic infrastructure
# Runs when an agent session ends. Performs ICM health check and session summary.

set -euo pipefail

# ── Resolve ICM binary ──────────────────────────────────────────────────────
resolve_icm() {
  for candidate in \
    "$(command -v icm 2>/dev/null)" \
    "/opt/homebrew/bin/icm" \
    "/usr/local/bin/icm" \
    "$HOME/.local/bin/icm"; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ICM_BIN="$(resolve_icm 2>/dev/null || echo "")"

# ── Read hook input ──────────────────────────────────────────────────────────
HOOK_INPUT=""
if [ -p /dev/stdin ] || [ ! -t 0 ]; then
  HOOK_INPUT=$(cat 2>/dev/null || echo "{}")
else
  HOOK_INPUT="{}"
fi

# El mismo alcance y el mismo saneo que `post-tool-learning-hook.sh`: el
# contador es por sesión, así que éste es el nombre que hay que borrar. El
# `tr` evita que un id con `/` o `..` escriba fuera del temporal.
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id') or 'default')" 2>/dev/null | tr -cd 'A-Za-z0-9._-' || echo "default")
[ -n "$SESSION_ID" ] || SESSION_ID="default"
# ── ICM Health Check ─────────────────────────────────────────────────────────
if [ -n "$ICM_BIN" ] && [ -x "$ICM_BIN" ]; then
  echo "[session-close] Running ICM health check..." >&2
  "$ICM_BIN" health 2>/dev/null || echo "[session-close] ICM health check completed." >&2

  # Store session summary
  "$ICM_BIN" hook stop 2>/dev/null || true
else
  echo "[session-close] ICM not found — health check skipped." >&2
fi

# El contador de ESTA sesión, que es el nombre que escribe el hook de
# post-tool. Antes borraba `/tmp/aoi-post-tool-counter.$$` con su propio pid,
# un nombre que ese hook nunca usó —llevaba otro pid— así que el `rm` no
# limpió nada en toda su vida.
rm -f "/tmp/aoi-post-tool-counter.${SESSION_ID}" 2>/dev/null || true

# Y los de sesiones que murieron sin cerrar: uno por sesión abandonada sería un
# archivo de 2 bytes para siempre. El corte por antigüedad no puede pisar una
# sesión viva porque ninguna dura siete días. `-H` es obligatorio en macOS:
# `/tmp` es un symlink y `find` no lo atraviesa.
find -H /tmp -maxdepth 1 -name 'aoi-post-tool-counter.*' -mtime +7 -delete 2>/dev/null || true

# ── Success output ───────────────────────────────────────────────────────────
echo "{\"continue\":true,\"systemMessage\":\"Session ${SESSION_ID} closed. ICM health check complete.\"}" 2>/dev/null || true
exit 0
