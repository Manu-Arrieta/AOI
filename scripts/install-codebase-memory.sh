#!/usr/bin/env bash
# scripts/install-codebase-memory.sh — Optional codebase-memory-mcp installer.
#
# Installs only the upstream binary and deliberately skips the upstream agent
# configuration step. AOI keeps ownership of AGENTS/GEMINI surfaces and wires
# the MCP server at workspace scope via .vscode/mcp.json.
#
# Invocations:
#   bash scripts/install-codebase-memory.sh           # interactive
#   bash scripts/install-codebase-memory.sh --yes     # non-interactive keep/install
#   bash scripts/install-codebase-memory.sh --update  # force rerun upstream installer
#   bash scripts/install-codebase-memory.sh --ui      # install UI variant
#   bash scripts/install-codebase-memory.sh --dry-run # preview only

set -euo pipefail

AUTO_YES=0
DRY_RUN=0
UPDATE=0
VARIANT="standard"
UPSTREAM_URL="https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh"
INSTALL_DIR="$HOME/.local/bin"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) AUTO_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --update) UPDATE=1; shift ;;
    --ui) VARIANT="ui"; shift ;;
    --standard) VARIANT="standard"; shift ;;
    -h|--help)
      sed -n '2,17p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -t 1 ]]; then
  BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
else
  BLUE=''; GREEN=''; YELLOW=''; RED=''; BOLD=''; NC=''
fi

info()  { printf "${BLUE}▸${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()   { printf "${RED}✗${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}═══ %s ═══${NC}\n\n" "$1"; }

get_codebase_memory_path() {
  local resolved_path

  resolved_path="$(command -v codebase-memory-mcp 2>/dev/null || true)"
  if [[ -n "$resolved_path" ]]; then
    printf '%s' "$resolved_path"
    return 0
  fi

  resolved_path="$INSTALL_DIR/codebase-memory-mcp"
  if [[ -x "$resolved_path" ]]; then
    printf '%s' "$resolved_path"
    return 0
  fi

  return 1
}

run_upstream_installer() {
  local tmp_script
  tmp_script="$(mktemp)"
  trap 'rm -f "$tmp_script"' RETURN

  curl -fsSL "$UPSTREAM_URL" -o "$tmp_script"

  if [[ "$VARIANT" == "ui" ]]; then
    bash "$tmp_script" --skip-config --ui
  else
    bash "$tmp_script" --skip-config --standard
  fi
}

header "AOI codebase-memory-mcp installer (opcional)"
info "Modo seguro AOI: instalar binario + omitir config global (--skip-config)"

CURRENT_BIN="$(get_codebase_memory_path || true)"
if [[ -n "$CURRENT_BIN" && "$UPDATE" -eq 0 ]]; then
  CURRENT_VER="$($CURRENT_BIN --version 2>/dev/null || echo 'unknown')"
  if [[ "$AUTO_YES" -eq 1 ]]; then
    ok "codebase-memory-mcp ya instalado ($CURRENT_VER)"
    exit 0
  fi

  printf "${YELLOW}▸${NC} codebase-memory-mcp already installed (%s). [U]pdate / [K]eep? [k]: " "$CURRENT_VER"
  read -r CHOICE
  case "$CHOICE" in
    u|U) UPDATE=1 ;;
    *)
      ok "codebase-memory-mcp kept ($CURRENT_VER)"
      exit 0
      ;;
  esac
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  info "[DRY-RUN] curl -fsSL $UPSTREAM_URL -o <tmp>"
  info "[DRY-RUN] bash <tmp> --skip-config --$VARIANT"
  exit 0
fi

if ! run_upstream_installer; then
  err "Upstream installer failed"
  exit 1
fi

CURRENT_BIN="$(get_codebase_memory_path || true)"
if [[ -z "$CURRENT_BIN" ]]; then
  err "codebase-memory-mcp was installed but is not resolvable yet"
  err "Expected candidate: $INSTALL_DIR/codebase-memory-mcp"
  exit 1
fi

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  export PATH="$INSTALL_DIR:$PATH"
fi

ok "codebase-memory-mcp ready ($($CURRENT_BIN --version 2>/dev/null || echo 'version check pending'))"
ok "AOI will keep MCP registration workspace-local via .vscode/mcp.json"