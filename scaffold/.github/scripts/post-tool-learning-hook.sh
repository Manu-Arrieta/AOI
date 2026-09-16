#!/usr/bin/env bash
# post-tool-learning-hook.sh — PostToolUse hook
# Extracts learnings from tool outputs and persists them via ICM.
# Fires after every tool execution. Rate-limited to avoid overhead.

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

TOOL_NAME=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name',''))" 2>/dev/null || echo "")

# El contador tiene que sobrevivir ENTRE invocaciones, y cada invocación del
# hook es un proceso nuevo. Con `$$` —el pid del shell— cada tool call estrenaba
# archivo: el contador nunca pasaba de 1, así que el rate-limit de abajo no
# dejaba pasar nada, y además quedaba un archivo por tool call que nadie
# borraba. Medido el 2026-09-16: 1976 archivos en /tmp, 7,7 MB, de los cuales el
# 100% eran inalcanzables. La sesión es el alcance correcto: un contador por
# sesión, y `session-close-hook.sh` borra el suyo al cerrar.
#
# El `tr` no es decoración: el id viaja en un nombre de archivo, y uno que
# trajera `/` o `..` escribiría fuera del temporal.
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id') or 'default')" 2>/dev/null | tr -cd 'A-Za-z0-9._-' || echo "default")
[ -n "$SESSION_ID" ] || SESSION_ID="default"
COUNTER_FILE="/tmp/aoi-post-tool-counter.${SESSION_ID}"
COUNT=0
[ -f "$COUNTER_FILE" ] && COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo "$COUNT" > "$COUNTER_FILE"

# Only run ICM learning every 5 tool calls to avoid overhead
if [ $((COUNT % 5)) -ne 0 ]; then
  exit 0
fi

# ── ICM learning from tool output ────────────────────────────────────────────
if [ -n "$ICM_BIN" ] && [ -x "$ICM_BIN" ]; then
  # Let ICM extract facts from tool output (rule-based, zero LLM cost)
  "$ICM_BIN" hook post 2>/dev/null || true
  echo "[post-tool-learning] ICM facts extracted (tool: ${TOOL_NAME}, call #${COUNT})" >&2
else
  echo "[post-tool-learning] ICM not found — learning skipped." >&2
fi

# ── Success output ───────────────────────────────────────────────────────────
echo '{"continue":true}' 2>/dev/null || true
exit 0
