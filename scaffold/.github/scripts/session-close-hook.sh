#!/usr/bin/env bash
# session-close-hook.sh — session-close hook for AOI agentic infrastructure
# Copilot lo declara en `Stop`; en Claude Code install-hooks.mjs lo cablea en
# `SessionEnd`, porque allí `Stop` corre al final de CADA turno (100 disparos
# en 14 sesiones de los transcripts de este repositorio) y este hook es de cierre.
#
# stdout lleva sólo el JSON final. Antes imprimía ~35 KB de `icm health`
# delante (226 784 B en esos 100 disparos), y un stdout que no empieza con `{`
# se lee como texto: el `systemMessage` nunca llegó. El informe va a stderr,
# que es diagnóstico.
#
# Ya no borra el contador de post-tool en cada disparo: con `Stop` eso reseteaba
# el rate-limit de post-tool-learning-hook.sh en cada turno, y ese hook se
# retiró (llamaba a `icm hook post` con el stdin ya consumido).
#
# No llama a `icm hook stop`: ese subcomando no existe (`icm hook --help`;
# exit 2, silenciado con `|| true` desde siempre). El resumen de sesión real es
# `icm hook end`, y ya lo dispara el settings de usuario de `icm init --mode hook`.

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

# El id viaja dentro de un JSON; el `tr` le saca lo que lo rompería.
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id') or 'default')" 2>/dev/null | tr -cd 'A-Za-z0-9._-' || echo "default")
[ -n "$SESSION_ID" ] || SESSION_ID="default"

# ── ICM Health Check ─────────────────────────────────────────────────────────
if [ -n "$ICM_BIN" ] && [ -x "$ICM_BIN" ]; then
  echo "[session-close] Running ICM health check..." >&2
  "$ICM_BIN" health >&2 2>/dev/null || echo "[session-close] ICM health check completed." >&2
else
  echo "[session-close] ICM not found — health check skipped." >&2
fi

# Contadores que dejó `post-tool-learning-hook.sh`, ya retirado: escribía uno
# por sesión en /tmp. Nadie los escribe ahora, pero una sesión abandonada de
# antes dejaba su archivo para siempre. El corte por antigüedad no puede pisar
# a un workspace instalado con la versión vieja, porque ninguna sesión dura
# siete días. `-H` es obligatorio en macOS: `/tmp` es un symlink y `find` no
# lo atraviesa.
find -H /tmp -maxdepth 1 -name 'aoi-post-tool-counter.*' -mtime +7 -delete 2>/dev/null || true

# ── Success output ───────────────────────────────────────────────────────────
echo "{\"continue\":true,\"systemMessage\":\"Session ${SESSION_ID} closed. ICM health check complete.\"}" 2>/dev/null || true
exit 0
