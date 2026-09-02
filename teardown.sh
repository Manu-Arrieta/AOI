#!/usr/bin/env bash
# teardown.sh — AOI Remover
# Removes all agentic infrastructure installed by setup.sh from a target project
# Windows users should run teardown.ps1 from PowerShell.
#
# Usage:
#   ./teardown.sh                        # interactive
#   ./teardown.sh /path/to/my-project    # direct

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()  { printf "${BLUE}▸${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()   { printf "${RED}✗${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}═══ %s ═══${NC}\n\n" "$1"; }

# ── Target project path ────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  PROJECT_PATH="$1"
else
  printf "📂 Project path to remove AOI from:\n> "
  read -r PROJECT_PATH
fi

PROJECT_PATH="$(eval echo "$PROJECT_PATH")"

if [ ! -d "$PROJECT_PATH" ]; then
  err "Directory not found: $PROJECT_PATH"
  exit 1
fi

PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"

header "AOI Teardown → $PROJECT_NAME"

printf "${YELLOW}This will remove all agentic infrastructure from:${NC}\n"
printf "  %s\n\n" "$PROJECT_PATH"
printf "Folders/files to remove:\n"
printf "  .github/agents/\n"
printf "  .github/hooks/\n"
printf "  .github/instructions/\n"
printf "  .github/prompts/\n"
printf "  .github/scripts/\n"
printf "  .github/skills/\n"
printf "  .githooks/\n"
printf "  .specify/\n"
printf "  .resources/\n"
printf "  aoi_apps/agentic-ops-dashboard/ (including package.json, pnpm-lock.yaml, node_modules/)\n"
printf "  scripts/aoi-headroom-wrap.sh\n"
printf "  scripts/bin/aoi-copilot\n"
printf "  .conf/     (configuration snapshot)\n"
printf "  .sandboxes/ (sandbox environments)\n"
printf "  .exportsmemories/ (memory export bundles)\n\n"
printf "${BOLD}Confirm? [y/N] ${NC}"
read -r CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  warn "Aborted."
  exit 0
fi

header "Removing Infrastructure"

cd "$PROJECT_PATH"

# ── Agentic scaffold folders ──────────────────────────────────────────────
remove_dir() {
  local dir="$1"
  if [ -d "$PROJECT_PATH/$dir" ]; then
    rm -rf "$PROJECT_PATH/$dir"
    ok "Removed $dir/"
  else
    warn "Not found: $dir/ (skipped)"
  fi
}

remove_dir ".agent"
remove_dir ".agents"
remove_dir ".specify"
remove_dir ".resources"
remove_dir ".atl"
remove_dir ".conf"
remove_dir ".sandboxes"
remove_dir ".exportsmemories"
remove_dir "aoi_apps/agentic-ops-dashboard"
remove_dir "scaffold"

if [ -d "$PROJECT_PATH/.tasks" ]; then
  ok "Preserved .tasks/ (work history retained for recovery)"
fi

if [ -d "$PROJECT_PATH/aoi_apps" ] && [ -z "$(ls -A "$PROJECT_PATH/aoi_apps" 2>/dev/null)" ]; then
  rm -rf "$PROJECT_PATH/aoi_apps"
  ok "Removed aoi_apps/ (was empty)"
fi

# .github — only remove AOI subdirs, not the whole .github (may have workflows etc.)
for subdir in agents hooks instructions prompts scripts skills; do
  remove_dir ".github/$subdir"
done

# .githooks — AOI pre-commit guard
remove_dir ".githooks"

# Restore original pre-commit if AOI chained itself into it
if [ -f "$PROJECT_PATH/.git/hooks/pre-commit.aoi-bak" ]; then
  mv "$PROJECT_PATH/.git/hooks/pre-commit.aoi-bak" "$PROJECT_PATH/.git/hooks/pre-commit"
  ok "Restored .git/hooks/pre-commit from backup"
elif [ -f "$PROJECT_PATH/.git/hooks/pre-commit" ] && grep -q "pre-commit-aoi-guard.sh" "$PROJECT_PATH/.git/hooks/pre-commit"; then
  rm -f "$PROJECT_PATH/.git/hooks/pre-commit"
  ok "Removed AOI pre-commit hook"
fi

# Phase 1.7 artifacts — aoi-headroom-wrap and aoi-copilot shim
if [ -f "$PROJECT_PATH/scripts/aoi-headroom-wrap.sh" ]; then
  rm -f "$PROJECT_PATH/scripts/aoi-headroom-wrap.sh"
  ok "Removed scripts/aoi-headroom-wrap.sh"
fi
if [ -f "$PROJECT_PATH/scripts/bin/aoi-copilot" ]; then
  rm -f "$PROJECT_PATH/scripts/bin/aoi-copilot"
  ok "Removed scripts/bin/aoi-copilot"
fi
if [ -d "$PROJECT_PATH/scripts/bin" ] && [ -z "$(ls -A "$PROJECT_PATH/scripts/bin" 2>/dev/null)" ]; then
  rm -rf "$PROJECT_PATH/scripts/bin"
  ok "Removed scripts/bin/ (was empty)"
fi
if [ -d "$PROJECT_PATH/scripts" ] && [ -z "$(ls -A "$PROJECT_PATH/scripts" 2>/dev/null)" ]; then
  rm -rf "$PROJECT_PATH/scripts"
  ok "Removed scripts/ (was empty)"
fi

# copilot-instructions.md is created by `icm init --mode cli` inside .github/
if [ -f "$PROJECT_PATH/.github/copilot-instructions.md" ]; then
  rm -f "$PROJECT_PATH/.github/copilot-instructions.md"
  ok "Removed .github/copilot-instructions.md"
fi

# Remove .github itself only if now empty
if [ -d ".github" ] && [ -z "$(ls -A .github 2>/dev/null)" ]; then
  rm -rf ".github"
  ok "Removed .github/ (was empty)"
fi

# ── Root files from AOI ────────────────────────────────────────────────
remove_aoi_file() {
  local file="$1"
  local marker="$2"
  if [ -f "$PROJECT_PATH/$file" ]; then
    if grep -q "$marker" "$PROJECT_PATH/$file" 2>/dev/null; then
      rm -f "$PROJECT_PATH/$file"
      ok "Removed $file"
    else
      warn "$file exists but was not created by AOI (skipped)"
    fi
  fi
}

remove_aoi_file ".windsurfrules"   "icm"
remove_aoi_file "CLAUDE.md"        "AOI"
remove_aoi_file "AGENTS.md"        "AOI"
remove_aoi_file ".cursorrules"     "AOI"
remove_aoi_file ".clinerules"      "AOI"
remove_aoi_file ".cursor/rules/aoi-rules.mdc" "AOI"

if [ -d "$PROJECT_PATH/.cursor/rules" ] && [ -z "$(ls -A "$PROJECT_PATH/.cursor/rules" 2>/dev/null)" ]; then
  rm -rf "$PROJECT_PATH/.cursor/rules"
  [ -z "$(ls -A "$PROJECT_PATH/.cursor" 2>/dev/null)" ] && rm -rf "$PROJECT_PATH/.cursor"
fi

# Legacy cleanup: older AOI installs created dashboard workspace files at repo root.
if [ -f "$PROJECT_PATH/package.json" ] && grep -q "AOI Agentic Operational Infrastructure Runtime" "$PROJECT_PATH/package.json" 2>/dev/null; then
  rm -f "$PROJECT_PATH/package.json"
  ok "Removed package.json"
  rm -f "$PROJECT_PATH/pnpm-workspace.yaml" 2>/dev/null && ok "Removed pnpm-workspace.yaml" || true
  rm -f "$PROJECT_PATH/pnpm-lock.yaml" 2>/dev/null && ok "Removed pnpm-lock.yaml" || true
  remove_dir "node_modules"
  remove_dir ".pnpm-store"
fi

# ── .vscode/settings.json — remove only the injected PATH key ─────────────
VSCODE_SETTINGS="$PROJECT_PATH/.vscode/settings.json"
if [ -f "$VSCODE_SETTINGS" ]; then
  python3 - "$VSCODE_SETTINGS" <<'PYEOF'
import sys, json

path = sys.argv[1]
with open(path, "r") as f:
    settings = json.load(f)

removed = []
for key in ["terminal.integrated.env.osx", "terminal.integrated.automationProfile.osx", "terminal.integrated.env.windows"]:
    if key in settings:
        del settings[key]
        removed.append(key)

if removed:
    with open(path, "w") as f:
        json.dump(settings, f, indent=4)
        f.write("\n")
    for k in removed:
        print(f"  \033[32m✓\033[0m Removed {k} from .vscode/settings.json")
PYEOF
fi

# Remove .vscode if empty
if [ -d ".vscode" ] && [ -z "$(ls -A .vscode 2>/dev/null)" ]; then
  rm -rf ".vscode"
  ok "Removed .vscode/ (was empty)"
fi

# ── ICM Bootstrap cleanup ──────────────────────────────────────────────────
if command -v icm &>/dev/null; then
  info "Cleaning ICM project data for $PROJECT_NAME..."
  icm forget -t "$PROJECT_NAME-context" 2>/dev/null && ok "ICM memory cleared ($PROJECT_NAME-context)" || true
  icm memoir delete -n "$PROJECT_NAME-architecture" 2>/dev/null && ok "ICM memoir deleted ($PROJECT_NAME-architecture)" || true
  icm memoir delete -n "$PROJECT_NAME-domain-model"  2>/dev/null && ok "ICM memoir deleted ($PROJECT_NAME-domain-model)" || true
fi

# ── Done ──────────────────────────────────────────────────────────────────
header "Teardown Complete"

echo "  Project: $PROJECT_PATH"
echo ""
echo "  Removed: agentic scaffold, spec-kit init, PATH injection, dashboard runtime"
echo "  Preserved: your source code, venv, docker, tests, etc."
echo ""
