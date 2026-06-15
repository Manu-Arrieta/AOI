#!/bin/sh
# validate-sync.sh — Validates Copilot ↔ Antigravity synchronization
#
# Usage:
#   ./validate-sync.sh           # validate ALL agents
#   ./validate-sync.sh <name>    # validate specific agent

set -e

WORKSPACE="$(cd "$(dirname "$0")/../../" && pwd)"
COPILOT_DIR="$WORKSPACE/.github/agents"
ANTIGRAVITY_DIR="$WORKSPACE/.agent/skills/agents"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
CHECKED=0

validate_agent() {
  local name=$1
  local copilot="$COPILOT_DIR/${name}.agent.md"
  local antigravity="$ANTIGRAVITY_DIR/${name}.md"
  CHECKED=$((CHECKED + 1))

  if [ ! -f "$copilot" ]; then
    printf "${YELLOW}⚠ MISSING Copilot: %s${NC}\n" "$copilot"
    return 0
  fi

  if [ ! -f "$antigravity" ]; then
    printf "${RED}✗ DIVERGENCE: %s exists in Copilot but NOT in Antigravity${NC}\n" "$name"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  printf "${GREEN}✓ Synced: %s${NC}\n" "$name"
}

# Also check reverse: Antigravity agents not in Copilot
validate_reverse() {
  for skill_file in "$ANTIGRAVITY_DIR"/*.md; do
    [ -f "$skill_file" ] || continue
    local name=$(basename "$skill_file" .md)
    local copilot="$COPILOT_DIR/${name}.agent.md"

    if [ ! -f "$copilot" ]; then
      printf "${RED}✗ DIVERGENCE: %s exists in Antigravity but NOT in Copilot${NC}\n" "$name"
      ERRORS=$((ERRORS + 1))
    fi
  done
}

echo "Validating Copilot ↔ Antigravity sync..."
echo ""

if [ -z "$1" ]; then
  for agent_file in "$COPILOT_DIR"/*.agent.md; do
    [ -f "$agent_file" ] || continue
    name=$(basename "$agent_file" .agent.md)
    # spec-kit subagents (speckit.*) mirror Antigravity skills, not agents,
    # so they are exempt from the agent dual-sync check.
    case "$name" in
      speckit.*) continue ;;
    esac
    validate_agent "$name"
  done
  validate_reverse
else
  validate_agent "$1"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  printf "${RED}✗ %d divergence(s) found in %d agents${NC}\n" "$ERRORS" "$CHECKED"
  exit 1
else
  printf "${GREEN}✓ All %d agents synced${NC}\n" "$CHECKED"
  exit 0
fi
