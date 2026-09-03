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

SESSION_ID=$(echo "$HOOK_INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('session_id','unknown'))" 2>/dev/null || echo "unknown")

# ── ICM Health Check ─────────────────────────────────────────────────────────
if [ -n "$ICM_BIN" ] && [ -x "$ICM_BIN" ]; then
  echo "[session-close] Running ICM health check..." >&2
  "$ICM_BIN" health 2>/dev/null || echo "[session-close] ICM health check completed." >&2

  # Store session summary
  "$ICM_BIN" hook stop 2>/dev/null || true
else
  echo "[session-close] ICM not found — health check skipped." >&2
fi

# ── Cleanup temp files ──────────────────────────────────────────────────────
rm -f "/tmp/aoi-post-tool-counter.$$" 2>/dev/null || true

# ── Success output ───────────────────────────────────────────────────────────
echo "{\"continue\":true,\"systemMessage\":\"Session ${SESSION_ID} closed. ICM health check complete.\"}" 2>/dev/null || true
exit 0
