#!/usr/bin/env bash
# scripts/install-archify.sh — Archify skill installer (diagram authoring gate).
#
# Archify compiles a typed JSON-IR into a validated, self-contained HTML diagram.
# AOI uses it in Phase -2 (`/sdd-genesis`) for two things, and neither is a token
# saving:
#
#   1. A `sequence` diagram for every declared boundary crossing — the artefact
#      the Blueprint Gate points at when it says a crossing must have a flow.
#   2. `Architecture Delta` between two validated blueprints, which is what
#      detects drift when one coupled SBC changes under another.
#
# It is installed GLOBALLY and deliberately not vendored into the repository.
# `.agents/skills` is a governed path: dropping a third-party skill there would
# make scaffold mirror parity demand a byte-for-byte copy of upstream inside the
# scaffold, which is a vendoring burden for something upstream already versions.
#
# Invocations:
#   bash scripts/install-archify.sh            # interactive
#   bash scripts/install-archify.sh --yes      # non-interactive keep/install
#   bash scripts/install-archify.sh --update   # reinstall / refresh
#   bash scripts/install-archify.sh --dry-run  # preview only

set -euo pipefail

AUTO_YES=0
DRY_RUN=0
UPDATE=0
# The agents whose global skill roots AOI's harnesses read. `codex` resolves to
# ~/.agents/skills (the Antigravity/Codex root); `claude-code` to ~/.claude/skills.
SKILL_AGENTS=("codex" "claude-code")
SKILL_SPEC="tt-a1i/archify"
SKILL_NAME="archify"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes) AUTO_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --update) UPDATE=1; shift ;;
    -h|--help)
      sed -n '2,20p' "$0"
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

# Candidate entry points, most-specific first. The renderer is the thing that
# must exist: a skill directory without it can be described but not run.
archify_entry_points() {
  printf '%s\n' \
    "$HOME/.agents/skills/$SKILL_NAME/bin/archify.mjs" \
    "$HOME/.claude/skills/$SKILL_NAME/bin/archify.mjs" \
    "$HOME/.agents/skills/$SKILL_NAME/archify/bin/archify.mjs" \
    "$HOME/.claude/skills/$SKILL_NAME/archify/bin/archify.mjs"
}

# Verifies by LOCATING the renderer, not by trusting the installer's exit code.
# The upstream `skills` CLI exits 0 on the commands it accepts whether or not the
# target it wrote is one this repository can actually reach.
find_archify() {
  local candidate
  while IFS= read -r candidate; do
    [[ -f "$candidate" ]] && { printf '%s' "$candidate"; return 0; }
  done < <(archify_entry_points)
  return 1
}

install_for_agent() {
  local agent="$1"
  # `--copy` over symlink on purpose: a symlinked skill breaks whenever the CLI
  # cache is pruned, and the whole point of pinning this tool is determinism.
  npx -y skills add "$SKILL_SPEC" \
    --skill "$SKILL_NAME" \
    --agent "$agent" \
    --global --copy --yes
}

header "AOI Archify installer"
info "Rol en AOI: determinismo y detección de deriva arquitectónica — NO ahorro de tokens."

if ! command -v node &>/dev/null; then
  err "Archify requires Node.js, and no node binary was found."
  exit 1
fi

if ! command -v npx &>/dev/null; then
  err "Archify is distributed through the 'skills' CLI; npx is required."
  exit 1
fi

CURRENT_BIN="$(find_archify || true)"
if [[ -n "$CURRENT_BIN" && "$UPDATE" -eq 0 ]]; then
  if [[ "$AUTO_YES" -eq 1 ]]; then
    ok "archify already installed ($CURRENT_BIN)"
    exit 0
  fi

  printf "${YELLOW}▸${NC} archify already installed at %s. [U]pdate / [K]eep? [k]: " "$CURRENT_BIN"
  read -r CHOICE
  case "$CHOICE" in
    u|U) UPDATE=1 ;;
    *)
      ok "archify kept ($CURRENT_BIN)"
      exit 0
      ;;
  esac
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  for agent in "${SKILL_AGENTS[@]}"; do
    info "[DRY-RUN] npx -y skills add $SKILL_SPEC --skill $SKILL_NAME --agent $agent --global --copy --yes"
  done
  info "[DRY-RUN] verificaré luego: $HOME/.agents/skills/$SKILL_NAME/bin/archify.mjs"
  exit 0
fi

for agent in "${SKILL_AGENTS[@]}"; do
  info "Instalando para '$agent'..."
  if ! install_for_agent "$agent"; then
    warn "el CLI falló para '$agent' — sigo con el resto."
  fi
done

CURRENT_BIN="$(find_archify || true)"
if [[ -z "$CURRENT_BIN" ]]; then
  err "El instalador terminó pero el renderizador no está en ninguna ruta esperada."
  err "Se esperaba algo como: $HOME/.agents/skills/$SKILL_NAME/bin/archify.mjs"
  err "Sin el renderizador, la compuerta de diagrama no puede satisfacerse."
  exit 1
fi

# El chequeo de update hace egress de red contra un manifest fijo. AOI lo corta:
# un instrumento que se conecta solo para avisar de una versión nueva introduce
# una dependencia de red en un flujo que se define por ser determinista.
export ARCHIFY_UPDATE_CHECK_DISABLED=1

ok "archify ready ($CURRENT_BIN)"
info "ARCHIFY_UPDATE_CHECK_DISABLED=1 — el chequeo de actualización queda desactivado."
info "Verificación: node \"$CURRENT_BIN\" doctor"
