#!/usr/bin/env bash
# icm-hook.sh — ICM hook wrapper for project-local Copilot configuration.

set -euo pipefail

MODE="${1:-}"

if [ -z "$MODE" ]; then
  echo "Usage: $0 <start|pre|post|prompt|compact>" >&2
  exit 1
fi

ICM_BIN=""

for candidate in \
  "$(command -v icm 2>/dev/null)" \
  "/opt/homebrew/bin/icm" \
  "/usr/local/bin/icm" \
  "$HOME/.local/bin/icm"
do
  if [ -x "$candidate" ]; then
    ICM_BIN="$candidate"
    break
  fi
done

if [ -z "$ICM_BIN" ]; then
  echo "[icm-hook] WARNING: icm binary not found in PATH or known locations. ICM hooks inactive." >&2
  exit 0
fi

exec "$ICM_BIN" hook "$MODE"