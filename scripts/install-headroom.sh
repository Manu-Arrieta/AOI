#!/usr/bin/env bash
# scripts/install-headroom.sh — Optional Headroom (headroom-ai) installation.
#
# Detects the preferred Python package manager in priority order matching the
# rest of the AOI bootstrapper (uv → pipx → pip), with brew as an optional alt
# on macOS. Default-installs on Apple-Silicon / Linux x86_64 / Windows-AMD64
# via pre-built wheels; warns and offers build-from-source fallback for Intel
# macOS where no prebuilt wheel is published.
#
# Invocations:
#   bash scripts/install-headroom.sh                         # interactive
#   bash scripts/install-headroom.sh --yes                   # skip prompts (default methods)
#   bash scripts/install-headroom.sh --method uv             # force one method
#   bash scripts/install-headroom.sh --dry-run               # plan only
#   bash scripts/install-headroom.sh --extras all            # extras: all|proxy|mcp|code|memory|evals
#   bash scripts/install-headroom.sh --update                # upgrade in place
#
# Exit codes:
#   0  ok (or skipped by design)
#   1  fatal error
#   2  no usable python package manager (operator can continue without)
#   3  install failed (operator reminder)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PKG="headroom-ai"
EXTRAS="${HEADROOM_EXTRAS:-all}"

AUTO_YES=0
DRY_RUN=0
METHOD=""
UPDATE=0

# ── Argument parsing ────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)     AUTO_YES=1; shift;;
    --dry-run) DRY_RUN=1; shift;;
    --method)  METHOD="${2:-}"; shift 2;;
    --extras)  EXTRAS="${2:-}"; shift 2;;
    --update)  UPDATE=1; shift;;
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

# ── Capability detection ────────────────────────────────────────────────────────
detect_arch() {
  case "$(uname -m 2>/dev/null)" in
    arm64|aarch64) echo "arm64";;
    x86_64|amd64)  echo "x86_64";;
    *)             echo "unknown";;
  esac
}

detect_intel_macos() {
  [[ "$(uname -s 2>/dev/null)" == "Darwin" ]] && [[ "$(detect_arch)" == "x86_64" ]]
}

has_command() { command -v "$1" &>/dev/null; }

# ── Re-entry / status ────────────────────────────────────────────────────────────
probe_installed() {
  if has_command headroom; then
    local ver
    ver="$(headroom --version 2>/dev/null || echo 'unknown')"
    ok "Headroom ya instalado ($ver)."
    return 0
  fi
  return 1
}

# ── Installer dispatch ───────────────────────────────────────────────────────────
install_with_uv() {
  info "Instalando vía uv tool (preferencia AOI):"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[DRY-RUN] uv tool install \"${PKG}[${EXTRAS}]\" --python python3.12"
    return 0
  fi
  if [[ "$UPDATE" -eq 1 ]]; then
    uv tool install --upgrade "headroom-ai[${EXTRAS}]" 2>/dev/null || \
      uv tool install --upgrade headroom-ai
  else
    uv tool install --python python3.12 "${PKG}[${EXTRAS}]"
  fi
}

install_with_pipx() {
  info "Instalando vía pipx:"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[DRY-RUN] pipx install --python python3.12 ${PKG}[${EXTRAS}]"
    return 0
  fi
  if [[ "$UPDATE" -eq 1 ]]; then
    pipx upgrade "${PKG}" || return 1
  else
    pipx install --python python3.12 "${PKG}[${EXTRAS}]"
  fi
}

install_with_pip_user() {
  info "Instalando vía pip --user (último fallback):"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    info "[DRY-RUN] python3 -m pip install --user --only-binary :all: ${PKG}[${EXTRAS}]"
    return 0
  fi
  python3 -m pip install --user --only-binary :all: "${PKG}[${EXTRAS}]"
}

install_with_brew() {
  if has_command brew; then
    warn "brew tap 'headroomlabs-ai/headroom' no está oficialmente publicado en homebrew-core."
    warn "Use uv, pipx o pip para mantener paridad con AOI bootstrapper. Saltando brew."
    return 1
  fi
  return 1
}

choose_method() {
  if [[ -n "$METHOD" ]]; then
    case "$METHOD" in
      uv)    has_command uv    && return 0 || { err "Método forzado uv pero uv no está en PATH"; exit 1; };;
      pipx)  has_command pipx  && return 0 || { err "Método forzado pipx pero pipx no está en PATH"; exit 1; };;
      pip)   has_command python3 && return 0 || { err "Método forzado pip pero python3 no está en PATH"; exit 1; };;
      brew)  has_command brew  && return 0 || { err "Método forzado brew pero brew no está en PATH"; exit 1; };;
      *)     err "Método desconocido: $METHOD (use uv|pipx|pip|brew)"; exit 1;;
    esac
  fi

  # Precedencia AOI: uv (más rápido + aislamiento) > pipx > pip
  if has_command uv; then
    METHOD="uv"; return 0
  fi
  if has_command pipx; then
    METHOD="pipx"; return 0
  fi
  if has_command python3; then
    METHOD="pip"; return 0
  fi
  return 1
}

# ── Main ────────────────────────────────────────────────────────────────────────
header "AOI Headroom installer (opcional)"
info "Paquete target: ${PKG}[${EXTRAS}]"

ARCH="$(detect_arch)"
PLATFORM_OS="$(uname -s 2>/dev/null || echo unknown)"
info "Plataforma: ${PLATFORM_OS}/${ARCH}"

if probe_installed && [[ "$UPDATE" -eq 0 ]]; then
  warn "Headroom ya está instalado. Use --update para actualizar o --yes para reintentar."
  if [[ "$AUTO_YES" -eq 0 ]]; then
    printf "${YELLOW}▸${NC} ¿Continuar anyway? [y/N]: "
    read -r CH
    case "$CH" in
      y|Y|yes|YES) ;;
      *) info "Saltado por elección del operador. AOI continúa."; exit 0;;
    esac
  fi
fi

# Detect Intel macOS — needs Rust build, no prebuilt wheel
if detect_intel_macos; then
  warn "Intel macOS detectado. NO hay wheel prebuilt publicado para esta plataforma."
  warn "La instalación compilará desde source (Rust toolchain requerido)."
  warn "Si falta rustc, abortar con uvicorn-common 'error: cannot find rustc'."
  if [[ "$AUTO_YES" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
    printf "${YELLOW}▸${NC} ¿Continuar con build from source? [y/N]: "
    read -r INTEL_CH
    case "$INTEL_CH" in
      y|Y|yes|YES) ;;
      *) warn "Saltado por elección del operador."; exit 0;;
    esac
  fi
fi

if ! choose_method; then
  err "No hay Python package manager disponible (uv ≥ pipx ≥ python3 -m pip)."
  err "Instale uno: brew install uv | brew install pipx | apt install python3-pip"
  exit 2
fi

info "Method seleccionado: ${METHOD}"

# Consent (skip with --yes or --dry-run)
if [[ "$AUTO_YES" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  printf "${YELLOW}▸${NC} ¿Instalar ${PKG}[${EXTRAS}] vía ${METHOD}? [y/N]: "
  read -r CONSENT
  case "$CONSENT" in
    y|Y|yes|YES) ;;
    *) warn "Saltado por elección del operador. AOI continúa sin Headroom."; exit 0;;
  esac
fi

case "$METHOD" in
  uv)
    install_with_uv
    if [[ "$DRY_RUN" -eq 1 ]]; then
      ok "[DRY-RUN] Headroom se instalaría vía uv tool."
    else
      ok "Headroom instalado vía uv tool."
      if has_command headroom; then
        ok "Verificación: $(headroom --version)"
      else
        warn "Headroom está instalado pero no aparece en el PATH actual. Reabrí la shell para refrescar env."
      fi
    fi
    ;;
  pipx)
    install_with_pipx
    if [[ "$DRY_RUN" -eq 1 ]]; then
      ok "[DRY-RUN] Headroom se instalaría vía pipx."
    else
      ok "Headroom instalado vía pipx."
      if has_command headroom; then
        ok "Verificación: $(headroom --version)"
      else
        warn "Headroom instalado pero no aparece en PATH actual. Reabrí la shell."
      fi
    fi
    ;;
  pip)
    install_with_pip_user
    if [[ "$DRY_RUN" -eq 1 ]]; then
      ok "[DRY-RUN] Headroom se instalaría vía pip --user."
    else
      ok "Headroom instalado vía pip --user."
      warn "Para usar 'headroom' puede requerir agregar ~/.local/bin al PATH actual."
    fi
    ;;
  brew)
    install_with_brew || { err "brew no viable"; exit 3; } ;;
esac

ok "Installer finalizado."
warn "Headroom está instalado pero NO está activo. Para activarlo:"
printf "  ${BLUE}headroom proxy --port 8787${NC}    # proxy OpenAI-compatible on localhost\n"
printf "  ${BLUE}headroom wrap copilot --subscription -- --model gpt-4o${NC}    # wrappear GitHub Copilot CLI\n"
warn "AVISO: NO corra 'headroom learn --apply' durante sesiones AOI activas — puede modificar GEMINI.md, AGENTS.md o CLAUDE.md sin awareness AOI. Use --dry-run y revise diff primero."
exit 0
