#!/usr/bin/env bash
# session-init-hook.sh — SessionStart hook for AOI agentic infrastructure
# Runs at the start of every agent session to ensure codebase and ICM are ready.
#
# Reads hook input from stdin (JSON) — uses cwd, session_id, hook_event_name.

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

CWD=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd','.'))" 2>/dev/null || echo ".")
SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")

# ── ICM Context Injection ────────────────────────────────────────────────────
if [ -n "$ICM_BIN" ] && [ -x "$ICM_BIN" ]; then
  # Wake-up pack: inject critical memories for the session
  "$ICM_BIN" hook start 2>/dev/null || true
else
  echo "[session-init] ICM not found — context injection skipped." >&2
fi

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
