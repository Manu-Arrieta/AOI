#!/usr/bin/env bash
# session-init-hook.sh — SessionStart hook for AOI agentic infrastructure
# Runs at the start of every agent session to check the codebase is ready.
#
# Reads hook input from stdin (JSON) — uses cwd.
#
# No inyecta el wake-up de ICM. Lo hacía, con un segundo `icm hook start`, y el
# pack llegaba repetido: el settings de usuario (`icm init --mode hook`) y
# `icm.json` → `icm-hook.sh start` ya lo disparan. Medido: 3 bloques idénticos
# de ~1,6 KB por arranque. Además imprimía `{"continue":true}` DESPUÉS de ese
# texto; un stdout que no empieza con `{` es texto plano entero, así que la
# línea JSON terminaba en el contexto como basura. Ahora stdout lleva sólo ese
# JSON, que es una respuesta de hook válida.

set -euo pipefail

# ── Read hook input ──────────────────────────────────────────────────────────
HOOK_INPUT=""
if [ -p /dev/stdin ] || [ ! -t 0 ]; then
  HOOK_INPUT=$(cat 2>/dev/null || echo "{}")
else
  HOOK_INPUT="{}"
fi

CWD=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd','.'))" 2>/dev/null || echo ".")

# ── Codebase Memory MCP readiness check ──────────────────────────────────────
# Check if codebase-memory-mcp is registered in .vscode/mcp.json
if [ -f "$CWD/.vscode/mcp.json" ]; then
  if grep -q "codebase-memo" "$CWD/.vscode/mcp.json" 2>/dev/null; then
    echo "[session-init] codebase-memory-mcp detected in .vscode/mcp.json" >&2
  fi
fi

# ── Success output ───────────────────────────────────────────────────────────
echo '{"continue":true}' 2>/dev/null || true
exit 0
