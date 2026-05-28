#!/usr/bin/env bash
# rtk-hook.sh — RTK PreToolUse hook wrapper
# Resolves RTK binary path for GUI apps (VS Code, Antigravity) that inherit
# a limited PATH from launchd and may not see Homebrew binaries.
#
# This script is called by:
#   .github/hooks/rtk-rewrite.json  (Copilot)
#   .agent/hooks/rtk-rewrite.json   (Antigravity)

set -euo pipefail

RTK_BIN=""

for candidate in \
  "$(command -v rtk 2>/dev/null)" \
  "/opt/homebrew/bin/rtk" \
  "/usr/local/bin/rtk" \
  "$HOME/.local/bin/rtk" \
  "$HOME/.cargo/bin/rtk"
do
  if [ -x "$candidate" ]; then
    RTK_BIN="$candidate"
    break
  fi
done

if [ -z "$RTK_BIN" ]; then
  # RTK not found — pass through stdin unmodified so the tool still runs
  cat
  exit 0
fi

exec "$RTK_BIN" hook copilot
