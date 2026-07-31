#!/usr/bin/env bash
# icm-serve.sh — Starts the ICM MCP server (stdio transport, compact mode)
# Used by .vscode/mcp.json to provide ICM tools to Copilot agents.
#
# ICM uses a GLOBAL database shared across all projects.
# Project isolation is handled via topic/memoir prefixes (see .github/instructions/icm-protocol.instructions.md)

set -euo pipefail

# Resolve icm binary — handles GUI app launches where Homebrew path may not be in PATH
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
  echo '{"error": "icm binary not found. Rerun project setup (setup.sh on macOS/Linux, setup.ps1 on Windows)."}' >&2
  exit 1
fi

exec "$ICM_BIN" serve --compact
