#!/usr/bin/env bash
# .githooks/post-commit-codebase-index.sh — Re-index codebase-memory-mcp after commit.
#
# Why this exists: codebase-memory-mcp builds a structural graph of the repo.
# After any commit the graph may be stale. This hook runs index_repository in
# background (non-blocking) so the next agent session always has a fresh index.
#
# Behaviour:
#   - Skips silently if codebase-memory-mcp is not installed (optional tool).
#   - Runs in background to never block the git commit flow.
#   - Writes output to /tmp/codebase-memory-mcp-index.log for inspection.
#
# Installation (done automatically by setup.sh):
#   ln -sf ../../.githooks/post-commit-codebase-index.sh .git/hooks/post-commit

set -euo pipefail

CBM_BIN="$(command -v codebase-memory-mcp 2>/dev/null || true)"
if [[ -z "$CBM_BIN" ]]; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_FILE="/tmp/codebase-memory-mcp-index.log"

# Run in background — never block the commit.
"$CBM_BIN" cli index_repository "{\"repo_path\": \"$REPO_ROOT\"}" \
  >> "$LOG_FILE" 2>&1 &

exit 0
