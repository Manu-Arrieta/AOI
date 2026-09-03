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

# ── Rate-limit (only process every 5th tool call) ───────────────────────────
COUNTER_FILE="/tmp/aoi-post-tool-counter.$$"
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
