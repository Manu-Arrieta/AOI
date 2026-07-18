#!/usr/bin/env bash
# scripts/nvidia-vscode-setup.sh — Optional NVIDIA customendpoint setup for VS Code.
#
# Detects the local VS Code User dir, copies the AOI scaffold
# `.vscode/ChatLanguageModel.example.json` to the appropriate location, and
# reminds the operator to replace the placeholder API key. Never touches git or
# commits secrets. Safe to run multiple times.
#
# Invocation:
#   bash scripts/nvidia-vscode-setup.sh                  # auto-detect + prompt
#   bash scripts/nvidia-vscode-setup.sh --yes            # skip confirmation
#   bash scripts/nvidia-vscode-setup.sh --key <APIKEY>   # apply API key during copy
#   bash scripts/nvidia-vscode-setup.sh --dry-run        # print actions without executing
#
# Exit codes:
#   0  ok (or skipped by design)
#   1  fatal error
#   2  vscode user dir not found (operator can continue without)
#   3  api key still placeholder after copy (operator reminder)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_FILE="$REPO_ROOT/scaffold/.vscode/ChatLanguageModel.example.json"
PLACEHOLDER="APIKEY-CONFIGURADA-PREVIAMENTE"

VSCODE_USER_DIR=""
AUTO_YES=0
API_KEY=""
DRY_RUN=0

# ── Argument parsing ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)      AUTO_YES=1; shift;;
    --key)      API_KEY="${2:-}"; shift 2;;
    --dry-run)  DRY_RUN=1; shift;;
    -h|--help)
      sed -n '2,30p' "$0"
      exit 0;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1;;
  esac
done

# ── Color helpers ────────────────────────────────────────────────────────────────
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

resolve_vscode_user_dir() {
  case "${OSTYPE:-}" in
    darwin*)  VSCODE_USER_DIR="$HOME/Library/Application Support/Code/User" ;;
    linux*)   VSCODE_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Code/User" ;;
    msys*|cygwin*|win32*)
      err "Use scripts/nvidia-vscode-setup.ps1 on Windows instead."
      exit 1
      ;;
    *)
      # Fallback heuristic
      if [[ -d "$HOME/.config/Code/User" ]]; then
        VSCODE_USER_DIR="$HOME/.config/Code/User"
      elif [[ -d "$HOME/Library/Application Support/Code/User" ]]; then
        VSCODE_USER_DIR="$HOME/Library/Application Support/Code/User"
      else
        return 1
      fi
      ;;
  esac
  return 0
}

# ── Profile-aware destination resolution ────────────────────────────────────────
# VS Code profiles re-route chatLanguageModels.json to
#   profiles/<profile-id>/chatLanguageModels.json
# when the workspace is associated with a non-default profile.
# If no profile association or default profile, falls back to root ChatLanguageModel.json.
resolve_profile_dest() {
  local storage_file="$VSCODE_USER_DIR/globalStorage/storage.json"
  local default_dest="$VSCODE_USER_DIR/ChatLanguageModel.json"

  if [[ ! -f "$storage_file" ]]; then
    echo "$default_dest"
    return
  fi

  # Build a file:// URI for the repo root (e.g. file:///Users/equinox/Desktop/Proyectos/AOI)
  local workspace_uri="file://$REPO_ROOT"

  local profile_id
  profile_id=$(python3 -c "
import json
with open('$storage_file') as f:
    data = json.load(f)
assoc = data.get('profileAssociations', {}).get('workspaces', {})
pid = assoc.get('$workspace_uri', '__default__profile__')
if pid != '__default__profile__':
    print(pid)
" 2>/dev/null || true)

  if [[ -n "$profile_id" && -d "$VSCODE_USER_DIR/profiles/$profile_id" ]]; then
    echo "$VSCODE_USER_DIR/profiles/$profile_id/chatLanguageModels.json"
  else
    echo "$default_dest"
  fi
}

# ── Sanity: template present ────────────────────────────────────────────────────
if [[ ! -f "$TEMPLATE_FILE" ]]; then
  err "Template missing: $TEMPLATE_FILE"
  exit 1
fi

header "NVIDIA customendpoint setup (opcional)"

resolve_vscode_user_dir || {
  warn "VS Code User dir not detected on this system. Skip opcional sin bloquear."
  exit 2
}

info "VS Code User dir detectado: $VSCODE_USER_DIR"
info "Template origen:   $TEMPLATE_FILE"

# Resolve profile-aware destination (may differ for workspaces with non-default profiles)
DEST_FILE=$(resolve_profile_dest)

info "Archivo destino:   $DEST_FILE (perfil: ${DEST_FILE##*profiles/})"
if [[ "$DEST_FILE" == *"/profiles/"* ]]; then
  info "  ️ → Workspace usa perfil VS Code: la configuración de modelos se aplica a este perfil."
fi

# Re-entry check: if the destination already exists, don't clobber without confirmation

if [[ -f "$DEST_FILE" ]]; then
  warn "El archivo destino ya existe: $DEST_FILE"
  if [[ "$AUTO_YES" -eq 0 ]]; then
    printf "${YELLOW}▸${NC} Sobrescribir el archivo existente? [y/N]: "
    read -r OVERWRITE_CHOICE
    case "$OVERWRITE_CHOICE" in
      y|Y|yes|YES) ;;
      *) warn "Skipped por elección del operador. AOI continúa con defaults vendor-copilot."; exit 0;;
    esac
  fi
fi

# Operator consent (skip with --yes or --dry-run)
if [[ "$AUTO_YES" -eq 0 && "$DRY_RUN" -eq 0 && -z "$API_KEY" ]]; then
  printf "${YELLOW}▸${NC} ¿Copiar template NVIDIA al VS Code User dir? [y/N]: "
  read -r CONSENT
  case "$CONSENT" in
    y|Y|yes|YES) ;;
    *) warn "Skipped por elección del operador. AOI continúa con defaults vendor-copilot."; exit 0;;
  esac
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  info "[DRY-RUN] mkdir -p \"$VSCODE_USER_DIR\""
  info "[DRY-RUN] cp \"$TEMPLATE_FILE\" \"$DEST_FILE\""
  if [[ -n "$API_KEY" ]]; then
    info "[DRY-RUN] sed replace placeholder='$PLACEHOLDER' -> api-key (hidden)"
  else
    info "[DRY-RUN] no --key provided: destino queda con placeholder $PLACEHOLDER"
  fi
  ok "DRY-RUN completado"
  exit 0
fi

mkdir -p "$VSCODE_USER_DIR"
cp "$TEMPLATE_FILE" "$DEST_FILE"

if [[ -n "$API_KEY" ]]; then
  # macOS sed requires -i ''; Linux uses -i
  if sed --version >/dev/null 2>&1; then
    sed -i "s|$PLACEHOLDER|$API_KEY|g" "$DEST_FILE"
  else
    sed -i '' "s|$PLACEHOLDER|$API_KEY|g" "$DEST_FILE"
  fi
  ok "API key reemplazada en $DEST_FILE"
else
  warn "Destino conserva placeholder '$PLACEHOLDER'. El operador debe editarlo manualmente."
  warn "Editá: $DEST_FILE"
fi

ok "NVIDIA customendpoint listo en $DEST_FILE"
warn "Recordatorio: NUNCA commitear $DEST_FILE. Está en .gitignore ('ChatLanguageModel.json', tracked: 'ChatLanguageModel.example.json')."
warn "Si NO reemplazás la API key, los modelos NVIDIA NO estarán accesibles — AOI continuará con defaults vendor-copilot (Gemini 3.1 Pro Preview / GPT-5.4 xhigh)."

exit 0
