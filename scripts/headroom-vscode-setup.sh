#!/usr/bin/env bash
# scripts/headroom-vscode-setup.sh — Print Headroom runtime env plan for the operator.
#
# Unlike `nvidia-vscode-setup.sh`, this script does NOT write secrets to VS Code
# `ChatLanguageModel.json` (those belong to the NVIDIA customendpoint layer and
# are orthogonal). Headroom is configured by:
#   1. Optional Copilot OAuth token (`GITHUB_COPILOT_TOKEN` or auto-detected
#      from `gh auth token` / macOS Keychain via `headroom copilot-auth login`).
#   2. Runtime env vars: `HEADROOM_HOST`, `HEADROOM_PORT`, `HEADROOM_PROXY_PORT`.
#   3. Workspace dir `~/.headroom` (or `$HOME/.headroom`) for stats/memory.
#
# This script emits an actionable plan and prints the exact shell snippet the
# operator should paste into `~/.zshrc` / `~/.bashrc` / `~/.profile` to keep
# the configuration persistent. Does NOT modify shell rc files automatically
# to avoid silent edits. Idempotent.
#
# Invocations:
#   bash scripts/headroom-vscode-setup.sh                # interactive info
#   bash scripts/headroom-vscode-setup.sh --emit-bash    # print bash snippet
#   bash scripts/headroom-vscode-setup.sh --emit-zsh     # print zsh snippet
#   bash scripts/headroom-vscode-setup.sh --print-rc     # print to stdout for piping
#   bash scripts/headroom-vscode-setup.sh --dry-run      # alias of --print-rc

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

MODE="info"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --emit-bash|--print-rc|--dry-run) MODE="emit-bash"; shift;;
    --emit-zsh)                     MODE="emit-zsh";  shift;;
    --info|-h|--help)
      sed -n '2,30p' "$0"; exit 0;;
    *)
      echo "Unknown argument: $1" >&2; exit 1;;
  esac
done

if [[ -t 1 ]]; then
  BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'
else
  BLUE=''; GREEN=''; YELLOW=''; BOLD=''; NC=''
fi
info()  { printf "${BLUE}▸${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}═══ %s ═══${NC}\n\n" "$1"; }

if [[ "$MODE" == "emit-bash" || "$MODE" == "emit-zsh" ]]; then
  cat <<'EOF'
# Headroom runtime env (adjacent to AOI bootstrapper — does NOT touch VS Code
# ChatLanguageModel.json which belongs to NVIDIA customendpoint layer)
export HEADROOM_HOST=127.0.0.1
export HEADROOM_PORT=8787
export HEADROOM_PROXY_PORT=8787
# Optional: GitHub Copilot CLI token for `headroom wrap copilot --subscription`
# export GITHUB_COPILOT_TOKEN=ghp_xxxxx              # OR run `headroom copilot-auth login`
# Optional: opt-out of in-proxy update check
# export HEADROOM_UPDATE_CHECK=off
# Optional: output shaper (off by default)
# export HEADROOM_OUTPUT_SHAPER=1
EOF
  exit 0
fi

header "Headroom config plan"
info "Headroom NO toca archivos VS Code. Se configura por envvars."
info "Este bootstrap NO modifica automáticamente ~/.zshrc / ~/.bashrc / ~/.profile."
info ""

info "── Pasos opcionales para el operador ──"
printf "  ${BLUE}1${NC}. (Persistir env vars) Pegar este snippet en tu shell rc:\n"
printf "\n"
printf "      ${BLUE}# %% Headroom (env vars persistente)\n"
printf "      export HEADROOM_HOST=127.0.0.1\n"
printf "      export HEADROOM_PORT=8787\n"
printf "      export HEADROOM_PROXY_PORT=8787\n"
printf "      # Opcionales: ver abajo\n"
printf "\n"
printf "  ${BLUE}2${NC}. (Opcional) Autenticar GitHub Copilot CLI subscription:\n"
printf "      ${BLUE}headroom copilot-auth login${NC}\n"
printf "\n"
printf "  ${BLUE}3${NC}. (Opcional) Activar el proxy:\n"
printf "      ${BLUE}headroom proxy --port \${HEADROOM_PORT:-8787}${NC}\n"
printf "\n"
printf "  ${BLUE}4${NC}. (Opcional) Wrappear Copilot CLI:\n"
printf "      ${BLUE}headroom wrap copilot --subscription -- --model gpt-4o${NC}\n"
printf "\n"

info "── Emisión rápida (copy-paste) ──"
warn "--emit-bash / --emit-zsh imprime el snippet al stdout sin interactividad:"
printf "  ${BLUE}bash scripts/headroom-vscode-setup.sh --emit-bash >> ~/.bashrc${NC}\n"
printf "  ${BLUE}bash scripts/headroom-vscode-setup.sh --emit-zsh >> ~/.zshrc${NC}\n"
printf "\n"

header "Avisos importantes"
warn "headroom learn --apply puede escribir sobre GEMINI.md / AGENTS.md / CLAUDE.md sin awareness AOI."
warn "Si usas AOI bootstrapper, NO corras 'headroom learn --apply' sin revisar 'git diff' primero."
warn "  Recomendación: usar 'headroom learn --dry-run' y mergear manualmente si el diff toca archivos AOI-managed."
warn "Cuando termines, hacé 'git checkout -- GEMINI.md AGENTS.md CLAUDE.md' para descartar cambios no aprobados."
printf "\n"

info "── Estado actual ──"
if command -v headroom &>/dev/null; then
  ok "Headroom instalado: $(headroom --version 2>/dev/null || echo unknown)"
else
  warn "Headroom NO instalado. Para instalar: bash scripts/install-headroom.sh"
fi
if [[ -d "${HOME:-/root}/.headroom" ]]; then
  ok "Workspace dir detectado: ${HOME}/.headroom"
else
  info "Workspace dir se creará al primer 'headroom proxy'. Path por default: ~/.headroom"
fi
ok "Documentación completa: https://headroom-docs.vercel.app/docs/installation"
