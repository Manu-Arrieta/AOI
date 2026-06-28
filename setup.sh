#!/usr/bin/env bash
# setup.sh — AOI Installer
# Installs agentic infrastructure (RTK + ICM + Spec-Kit) into a target project
# Windows Git Bash delegates to setup.ps1 automatically.
#
# Usage:
#   ./setup.sh                         # interactive
#   ./setup.sh /path/to/my-project     # direct

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAFFOLD_DIR="$SCRIPT_DIR/scaffold"

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

info()  { printf "${BLUE}▸${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
err()   { printf "${RED}✗${NC} %s\n" "$1"; }
header(){ printf "\n${BOLD}═══ %s ═══${NC}\n\n" "$1"; }

is_windows_git_bash() {
  case "${OSTYPE:-}" in
    msys*|cygwin*|win32*)
      return 0
      ;;
  esac

  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*)
      return 0
      ;;
  esac

  return 1
}

to_windows_path() {
  local path_value
  path_value="$1"

  if [ -z "$path_value" ]; then
    printf '%s' "$path_value"
    return 0
  fi

  if [[ "$path_value" =~ ^[A-Za-z]:[\\/].* ]]; then
    printf '%s' "$path_value"
    return 0
  fi

  if ! command -v cygpath &>/dev/null; then
    return 1
  fi

  cygpath -w "$path_value"
}

# Sanitize a PowerShell script before passing it to Windows PowerShell 5.1.
#
# Windows PowerShell 5.1 (powershell.exe) is notoriously picky:
#   - CRLF + Set-StrictMode Latest sometimes confuses the parser
#   - A UTF-8 BOM (0xEF 0xBB 0xBF) at the top can shift line numbers by 1
#   - BOM-less UTF-8 can be decoded with the active ANSI code page
#   - Smart quotes (' ' " ") pasted from editors break tokenization
#
# We copy the source file to a tempfile next to it, strip BOM + CR, and force
# UTF-8 with BOM. Caller MUST invoke the sanitized path with PowerShell and
# delete the tempfile when done.
sanitize_ps1_for_windows_powershell5() {
  local source_path="$1"
  local source_dir target_path stage_path

  if [ -z "$source_path" ] || [ ! -f "$source_path" ]; then
    err "sanitize_ps1_for_windows_powershell5: source not found: $source_path"
    return 1
  fi

  source_dir="$(cd "$(dirname "$source_path")" && pwd)"
  target_path="$(mktemp "$source_dir/aoi-setup-XXXXXX.ps1")"
  stage_path="$(mktemp "$source_dir/aoi-setup-stage-XXXXXX.ps1")"
  if [ -z "$target_path" ] || [ ! -f "$target_path" ] || [ -z "$stage_path" ]; then
    err "sanitize_ps1_for_windows_powershell5: could not create tempfile"
    return 1
  fi

  #   1. Strip UTF-8 BOM if present
  #   2. Strip CR (\r) — convert CRLF → LF
  # Write to a stage file directly (NOT via $()) so trailing \n is preserved.
  cat "$source_path" \
    | sed -e '1s/^\xEF\xBB\xBF//' \
          -e 's/\r$//' \
    > "$stage_path"

  # Smart-quote pass (only if iconv is available; non-fatal if it fails)
  if command -v iconv &>/dev/null && [ -s "$stage_path" ]; then
    cat "$stage_path" | iconv -f UTF-8 -t UTF-8//IGNORE 2>/dev/null > "$stage_path.new" \
      && mv "$stage_path.new" "$stage_path" || rm -f "$stage_path.new"
  fi

  # Replace curly quotes that editors love to inject.
  # bash's `tr` does not interpret \uXXXX, so use python or perl if available;
  # otherwise skip silently (the file in the repo never has these).
  if command -v python3 &>/dev/null && python3 -V >/dev/null 2>&1 && [ -s "$stage_path" ]; then
    python3 - "$stage_path" <<'PYEOF'
import sys
stage = sys.argv[1]
table = str.maketrans({
    chr(0x2018): chr(39),
    chr(0x2019): chr(39),
    chr(0x201C): chr(39),
    chr(0x201D): chr(39),
    chr(0x2013): "-",
    chr(0x2014): "-",
    chr(0x2026): "...",
})
with open(stage, "rb") as f:
    data = f.read().decode("utf-8", errors="replace")
with open(stage, "wb") as f:
    f.write(data.translate(table).encode("utf-8"))
PYEOF
  elif command -v perl &>/dev/null && [ -s "$stage_path" ]; then
    perl -CSDA -i -pe '
        s/\x{2018}|\x{2019}|\x{201C}|\x{201D}/'\''/g;
        s/\x{2013}|\x{2014}/-/g;
        s/\x{2026}/.../g;
    ' "$stage_path"
  fi

  # Ensure file ends with a single LF (PowerShell scripts need a final newline).
  # Append one only if missing — never truncate content.
  if [ ! -s "$stage_path" ]; then
    err "sanitize_ps1_for_windows_powershell5: stage is empty"
    rm -f "$stage_path" "$target_path"
    return 1
  fi
  last_byte="$(tail -c 1 "$stage_path" 2>/dev/null | od -An -c | tr -d ' \n')"
  if [ "$last_byte" = "n" ]; then
    last_byte="\\n"
  fi
  if [ "$last_byte" != "\\n" ] && [ -n "$last_byte" ]; then
    printf '\n' >> "$stage_path"
  fi

  # Windows PowerShell 5.1 treats UTF-8 without BOM as ANSI, which corrupts
  # non-ASCII tokens and can surface false parser errors.
  if ! {
    printf '\357\273\277' > "$target_path"
    cat "$stage_path" >> "$target_path"
  }; then
    err "sanitize_ps1_for_windows_powershell5: could not write BOM-safe tempfile"
    rm -f "$stage_path" "$target_path"
    return 1
  fi

  rm -f "$stage_path"

  SANITIZED_PS1_PATH="$target_path"
  return 0
}
invoke_windows_powershell() {
  local posix_script_path="$1"
  local windows_script_path="$2"
  local windows_project_path="$3"
  local bin

  for bin in pwsh.exe pwsh powershell.exe powershell; do
    if command -v "$bin" &>/dev/null; then
      info "Invoking $bin on $windows_script_path"

      # Windows PowerShell 5.1 path: sanitize first, run tempfile, clean up.
      case "$bin" in
        powershell.exe|powershell)
          if ! sanitize_ps1_for_windows_powershell5 "$posix_script_path"; then
            return 1
          fi
          local tmp_posix="$SANITIZED_PS1_PATH"
          local tmp_windows
          if ! tmp_windows="$(to_windows_path "$tmp_posix")"; then
            rm -f "$tmp_posix"
            err "Could not convert sanitized setup.ps1 path for Windows PowerShell: $tmp_posix"
            return 1
          fi
          "$bin" -NoProfile -ExecutionPolicy Bypass -File "$tmp_windows" "$windows_project_path"
          local rc=$?
          rm -f "$tmp_posix"
          return $rc
          ;;
        *)
          "$bin" -NoProfile -File "$windows_script_path" "$windows_project_path"
          return $?
          ;;
      esac
    fi
  done

  err "Git Bash on Windows requires powershell.exe, powershell, or pwsh to run setup.ps1."
  return 127
}

run_windows_setup_from_git_bash() {
  local project_path posix_script_path windows_project_path windows_script_path ps_exit_code ps_stderr saw_parser_error

  if [ -n "${1:-}" ]; then
    project_path="$1"
  else
    printf "📂 Project path to install AOI into:\n> "
    read -r project_path
  fi

  project_path="$(eval echo "$project_path")"

  posix_script_path="$SCRIPT_DIR/setup.ps1"

  if ! windows_script_path="$(to_windows_path "$posix_script_path")"; then
    err "Git Bash on Windows requires cygpath to delegate to setup.ps1."
    exit 1
  fi

  if ! windows_project_path="$(to_windows_path "$project_path")"; then
    err "Could not convert project path for Windows PowerShell: $project_path"
    exit 1
  fi

  info "Git Bash on Windows detected — delegating to setup.ps1"

  # Capture both streams so we can diagnose parse failures clearly.
  ps_stderr="$(mktemp -t "aoi-ps-err-XXXXXX.log")"
  invoke_windows_powershell "$posix_script_path" "$windows_script_path" "$windows_project_path" \
      2> "$ps_stderr"
  ps_exit_code=$?
  if [ "$ps_exit_code" -eq 0 ]; then
    rm -f "$ps_stderr"
    exit 0
  fi

  saw_parser_error=0
  warn "PowerShell exited with code $ps_exit_code"
  if [ -s "$ps_stderr" ]; then
    if grep -qiE 'Unexpected token|ParserError' "$ps_stderr"; then
      saw_parser_error=1
    fi
    err "PowerShell stderr:"
    while IFS= read -r line; do
      err "  $line"
    done < "$ps_stderr"
    rm -f "$ps_stderr"
  fi

  if [ "$saw_parser_error" -eq 1 ]; then
    # Common parser pitfalls surfaced to the operator.
    warn "If you see 'Unexpected token' parser errors, the most common causes are:"
    warn "  1) A UTF-8 BOM at the start of setup.ps1 — from Git Bash run: powershell -NoProfile -Command '\$utf8NoBom = New-Object Text.UTF8Encoding(\$false); [IO.File]::WriteAllText(\"setup.ps1\", ([IO.File]::ReadAllText(\"setup.ps1\") -replace \"^\\uFEFF\",\"\"), \$utf8NoBom)'"
    warn "  2) CRLF line endings mixed with Set-StrictMode Latest — sanity script handled this automatically; if it still fails, run: sed -i 's/\r$//' setup.ps1"
    warn "  3) The script being interpreted is NOT the one in this repo — verify from Git Bash with: powershell -NoProfile -Command \"Get-Content -Path 'D:\\AOI\\AOI\\setup.ps1' -TotalCount 1 | Format-Hex\""
  else
    warn "PowerShell failed before setup.ps1 completed. Copy the 'PowerShell stderr:' lines shown above and rerun with the current setup.sh if you want a narrower diagnosis."
  fi

  exit $ps_exit_code
}

if is_windows_git_bash; then
  run_windows_setup_from_git_bash "${1:-}"
fi

# ── Target project path ────────────────────────────────────────────────────
if [ -n "${1:-}" ]; then
  PROJECT_PATH="$1"
else
  printf "📂 Project path to install AOI into:\n> "
  read -r PROJECT_PATH
fi

PROJECT_PATH="$(eval echo "$PROJECT_PATH")"

if [ ! -d "$PROJECT_PATH" ]; then
  err "Directory not found: $PROJECT_PATH"
  exit 1
fi

PROJECT_PATH="$(cd "$PROJECT_PATH" && pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"

header "AOI → $PROJECT_NAME"

# ── Verify scaffold exists ─────────────────────────────────────────────────
if [ ! -d "$SCAFFOLD_DIR" ]; then
  err "Scaffold directory not found at: $SCAFFOLD_DIR"
  err "Make sure you're running from the AOI root."
  exit 1
fi

# ── Phase 1: Install Tools (RTK optional, ICM mandatory) ───────────────
header "Phase 1: Tools"

install_rtk() {
  if command -v rtk &>/dev/null; then
    CURRENT_VER="$(rtk --version 2>/dev/null || echo 'unknown')"
    printf "${YELLOW}▸${NC} RTK already installed (%s). [U]pdate / [K]eep? [k]: " "$CURRENT_VER"
    read -r CHOICE
    if [[ "$CHOICE" == "u" || "$CHOICE" == "U" ]]; then
      info "Updating RTK..."
      if command -v brew &>/dev/null; then
        brew upgrade rtk 2>/dev/null || brew install rtk-ai/tap/rtk || return 1
      else
        curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh || return 1
      fi
      ok "RTK updated → $(rtk --version 2>/dev/null)"
    else
      ok "RTK kept ($(rtk --version 2>/dev/null))"
    fi
    return 0
  fi
  info "Installing RTK (token optimizer)..."
  if command -v brew &>/dev/null; then
    brew tap rtk-ai/tap && brew install rtk || return 1
  else
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh || return 1
  fi
  command -v rtk &>/dev/null || return 1
  ok "RTK installed ($(rtk --version 2>/dev/null))"
}

install_icm() {
  if command -v icm &>/dev/null; then
    CURRENT_VER="$(icm --version 2>/dev/null || echo 'unknown')"
    printf "${YELLOW}▸${NC} ICM already installed (%s). [U]pdate / [K]eep? [k]: " "$CURRENT_VER"
    read -r CHOICE
    if [[ "$CHOICE" == "u" || "$CHOICE" == "U" ]]; then
      info "Updating ICM..."
      if command -v brew &>/dev/null; then
        brew upgrade icm 2>/dev/null || brew install rtk-ai/tap/icm
      else
        curl -fsSL https://raw.githubusercontent.com/rtk-ai/icm/main/install.sh | sh
      fi
      ok "ICM updated → $(icm --version 2>/dev/null)"
    else
      ok "ICM kept ($(icm --version 2>/dev/null))"
    fi
    return 0
  fi
  info "Installing ICM (persistent memory)..."
  if command -v brew &>/dev/null; then
    brew tap rtk-ai/tap && brew install icm
  else
    curl -fsSL https://raw.githubusercontent.com/rtk-ai/icm/main/install.sh | sh
  fi
  ok "ICM installed ($(icm --version 2>/dev/null))"
}

require_icm() {
  if command -v icm &>/dev/null; then
    return 0
  fi

  err "ICM is mandatory. Installation cannot continue without a working icm command."
  err "Fix the ICM install prerequisites and rerun setup.sh."
  exit 1
}

install_specify() {
  if command -v specify &>/dev/null; then
    ok "Specify CLI $(specify version 2>/dev/null || echo 'installed')"
    return
  fi
  info "Installing Specify CLI (spec-kit)..."
  if command -v uv &>/dev/null; then
    uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
  elif command -v pipx &>/dev/null; then
    pipx install specify-cli
  elif command -v pip &>/dev/null; then
    pip install specify-cli
  else
    warn "No Python package manager found (uv, pipx, pip)."
    warn "Install manually: uv tool install specify-cli --from git+https://github.com/github/spec-kit.git"
    return 1
  fi
  ok "Specify CLI installed"
}

install_uv() {
  if command -v uv &>/dev/null; then
    ok "uv $(uv --version 2>/dev/null || echo 'installed')"
    return
  fi
  info "Installing uv (Python package manager, required for spec-kit)..."
  if command -v brew &>/dev/null; then
    brew install uv
  else
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  ok "uv installed"
}

normalize_version() {
  printf '%s' "$1" | sed -E 's/^[^0-9]*//; s/[^0-9.].*$//'
}

version_ge() {
  local actual required
  local a1 a2 a3 r1 r2 r3

  actual="$(normalize_version "$1")"
  required="$(normalize_version "$2")"

  IFS=. read -r a1 a2 a3 <<EOF
$actual
EOF
  IFS=. read -r r1 r2 r3 <<EOF
$required
EOF

  a1=${a1:-0}; a2=${a2:-0}; a3=${a3:-0}
  r1=${r1:-0}; r2=${r2:-0}; r3=${r3:-0}

  if (( a1 != r1 )); then
    (( a1 > r1 ))
    return
  fi

  if (( a2 != r2 )); then
    (( a2 > r2 ))
    return
  fi

  (( a3 >= r3 ))
}

ensure_dashboard_runtime() {
  local node_version pnpm_version

  if ! command -v node &>/dev/null; then
    err "Dashboard runtime is mandatory. Node >=20.19.0 is required."
    exit 1
  fi

  node_version="$(node -p 'process.versions.node' 2>/dev/null || true)"
  if ! version_ge "$node_version" "20.19.0"; then
    err "Dashboard runtime requires Node >=20.19.0. Found: ${node_version:-unknown}"
    exit 1
  fi

  if command -v corepack &>/dev/null; then
    return 0
  fi

  if ! command -v pnpm &>/dev/null; then
    err "Dashboard runtime is mandatory. Install pnpm@11.3.0 or provide corepack before running setup.sh."
    exit 1
  fi

  pnpm_version="$(pnpm --version 2>/dev/null || true)"
  if ! version_ge "$pnpm_version" "11.3.0"; then
    err "Dashboard runtime requires pnpm >=11.3.0 when corepack is unavailable. Found: ${pnpm_version:-unknown}"
    exit 1
  fi
}

# Install order: RTK → ICM → uv → Specify
if ! install_rtk; then
  warn "RTK install failed — continuing without token optimization. Commands will run unfiltered until RTK is available."
fi
install_icm
require_icm
install_uv
install_specify || true

# ── Phase 1.5: Optional NVIDIA customendpoint helper (non-blocking) ────────
header "Phase 1.5: NVIDIA customendpoint (opcional)"

if [[ -f "$SCRIPT_DIR/scripts/nvidia-vscode-setup.sh" ]]; then
  info "Detectando VS Code para configurar custom endpoint NVIDIA (Kimi K2.6, DeepSeek V4 Pro, MiniMax M3, Qwen 3.5)"
  info "Presione Enter para ejecutar ahora, o 'n' + Enter para omitir (AOI seguirá funcionando con defaults vendor-copilot)."
  printf "${YELLOW}▸${NC} Configurar customendpoint NVIDIA? [Y/n]: "
  read -r NVIDIA_CHOICE
  case "$NVIDIA_CHOICE" in
    n|N|no|NO)
      warn "Saltado por elección del operador. AOI continúa con defaults vendor-copilot (Gemini 3.1 Pro Preview / GPT-5.4 xhigh)."
      ;;
    *)
      bash "$SCRIPT_DIR/scripts/nvidia-vscode-setup.sh" || {
        ret=$?
        warn "nvidia-vscode-setup.sh salió con código $ret — el setup continúa. El operador puede correrlo manualmente tras finalizar."
      }
      ;;
  esac
else
  warn "scripts/nvidia-vscode-setup.sh no encontrado junto a setup.sh — saltando Phase 1.5"
fi

# ── Phase 1.6: Headroom (headroom-ai) compression layer (MANDATORY) ────────
header "Phase 1.6: Headroom compression layer (obligatorio)"

if [[ -f "$SCRIPT_DIR/scripts/install-headroom.sh" ]]; then
  info "Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library para reducir"
  info "tokens 60-95% sin tocar código. Es CAPA OBLIGATORIA de AOI bootstrapper."
  info "AOI requiere Headroom. Si la instalación falla, el setup aborta."
  bash "$SCRIPT_DIR/scripts/install-headroom.sh" --yes || {
    ret=$?
    err "install-headroom.sh salió con código $ret. Headroom es obligatorio — el setup no puede continuar."
    exit $ret
  }
  if [[ -f "$SCRIPT_DIR/scripts/headroom-vscode-setup.sh" ]]; then
    info "Headroom se configura por envvars (NO modifica VS Code)."
    bash "$SCRIPT_DIR/scripts/headroom-vscode-setup.sh" || {
      ret=$?
      err "headroom-vscode-setup.sh falló con código $ret. Headroom es obligatorio — el setup no puede continuar."
      exit $ret
    }
  fi
  ok "Headroom instalado y configurado ($(headroom --version 2>/dev/null || echo 'version check pending'))"
else
  err "scripts/install-headroom.sh no encontrado junto a setup.sh."
  err "Headroom es obligatorio — el setup no puede continuar."
  exit 1
fi

# ── Phase 1.7: AOI Headroom integration (wrapper + managed-files guard) ────────
header "Phase 1.7: AOI Headroom integration (obligatorio)"

# Install the mandatory Copilot CLI wrapper into the target project, and the
# pre-commit guard that blocks `headroom learn` overwriting AOI-managed files.
# Without these, Headroom is installed but the SDD agent pipeline can bypass it,
# which violates the mandatory policy.

WRAP_SRC="$SCRIPT_DIR/scripts/aoi-headroom-wrap.sh"
GUARD_SRC="$SCRIPT_DIR/.githooks/pre-commit-aoi-guard.sh"

if [[ ! -f "$WRAP_SRC" || ! -f "$GUARD_SRC" ]]; then
  err "AOI Headroom integration assets missing in installer. Setup cannot complete."
  exit 1
fi

mkdir -p "$PROJECT_PATH/scripts"
mkdir -p "$PROJECT_PATH/.githooks"

cp "$WRAP_SRC" "$PROJECT_PATH/scripts/aoi-headroom-wrap.sh"
chmod +x "$PROJECT_PATH/scripts/aoi-headroom-wrap.sh"
ok "Installed aoi-headroom-wrap.sh → PROJECT/scripts/"

cp "$GUARD_SRC" "$PROJECT_PATH/.githooks/pre-commit-aoi-guard.sh"
chmod +x "$PROJECT_PATH/.githooks/pre-commit-aoi-guard.sh"
ok "Installed pre-commit-aoi-guard.sh → PROJECT/.githooks/"

# Register an shim that forces any `aoi-copilot` invoker through the wrapper.
# This is the seam SDD agents use instead of calling `copilot` directly.
mkdir -p "$PROJECT_PATH/scripts/bin"
cat > "$PROJECT_PATH/scripts/bin/aoi-copilot" <<'EOF_SHIM'
#!/usr/bin/env bash
# AOI Copilot shim — routes to aoi-headroom-wrap.sh so the call leaves via
# `headroom wrap copilot --subscription`. Bypassing AOI mandatory policy here
# is forbidden; the wrapper refuses to run when `headroom` is missing.
exec bash "$(dirname "$0")/../aoi-headroom-wrap.sh" "$@"
EOF_SHIM
chmod +x "$PROJECT_PATH/scripts/bin/aoi-copilot"
ok "Installed aoi-copilot shim → PROJECT/scripts/bin/"

# Wire up a project-local pre-commit hook chain to include the AOI guard unless
# the project intentionally wants to opt out. We respect any pre-existing
# pre-commit with a chain that calls our guard first.
PROJECT_GITHOOK="$PROJECT_PATH/.git/hooks/pre-commit"
if [[ -d "$PROJECT_PATH/.git" ]]; then
  if [[ -f "$PROJECT_GITHOOK" ]]; then
    if ! grep -q "pre-commit-aoi-guard.sh" "$PROJECT_GITHOOK"; then
      cp "$PROJECT_GITHOOK" "$PROJECT_GITHOOK.aoi-bak"
      cat > "$PROJECT_GITHOOK" <<'EOF_PRECOMMIT'
#!/usr/bin/env bash
# AOI bootstrap chain: run guard first, then delegate to project pre-commit.
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SELF_DIR/../../.githooks/pre-commit-aoi-guard.sh" "$@" || exit $?
if [ -f "$SELF_DIR/pre-commit.aoi-bak" ]; then
  exec bash "$SELF_DIR/pre-commit.aoi-bak" "$@"
fi
exit 0
EOF_PRECOMMIT
      chmod +x "$PROJECT_GITHOOK"
      ok "Chained AOI guard into existing pre-commit hook"
    else
      ok "AOI guard already chained into pre-commit (skipped)"
    fi
  else
    cp "$GUARD_SRC" "$PROJECT_GITHOOK"
    chmod +x "$PROJECT_GITHOOK"
    ok "Installed AOI pre-commit guard → .git/hooks/pre-commit"
  fi
else
  info "Target project is not a git repo — AOI guard will activate once 'git init' runs."
  info "    When ready, run: ln -sf ../../.githooks/pre-commit-aoi-guard.sh .git/hooks/pre-commit"
fi

# ── Phase 2: Initialize Spec-Kit ──────────────────────────────────────────
header "Phase 2: Spec-Kit"

cd "$PROJECT_PATH"

if command -v specify &>/dev/null; then
  info "Initializing spec-kit for Copilot..."
  specify init . --ai copilot --force 2>/dev/null && ok "Spec-kit → Copilot" || warn "Spec-kit Copilot init skipped (may need manual setup)"

  info "Initializing spec-kit for Antigravity..."
  specify init . --ai agy --ai-skills --force 2>/dev/null && ok "Spec-kit → Antigravity" || warn "Spec-kit Antigravity init skipped (may need manual setup)"
else
  warn "Specify CLI not found — skipping spec-kit init"
  warn "Run manually after installing: specify init . --ai copilot --force"
fi

# ── Phase 3: Copy Agentic Scaffold ───────────────────────────────────────
header "Phase 3: Agentic Infrastructure"

cd "$PROJECT_PATH"

# Copy scaffold using rsync (merge, don't destroy existing files)
if command -v rsync &>/dev/null; then
  rsync -a --ignore-existing "$SCAFFOLD_DIR/" "$PROJECT_PATH/"
  ok "Scaffold merged (rsync)"
else
  # Fallback: cp with directory creation
  cd "$SCAFFOLD_DIR"
  find . -type f | while read -r file; do
    target="$PROJECT_PATH/$file"
    if [ ! -f "$target" ]; then
      mkdir -p "$(dirname "$target")"
      cp "$file" "$target"
    fi
  done
  cd "$PROJECT_PATH"
  ok "Scaffold merged (cp)"
fi

# Ensure required directories exist (rsync may skip empty dirs)
mkdir -p "$PROJECT_PATH/.tasks"
mkdir -p "$PROJECT_PATH/.sandboxes"
mkdir -p "$PROJECT_PATH/.atl"
mkdir -p "$PROJECT_PATH/.resources"
mkdir -p "$PROJECT_PATH/.resources/userstories"
mkdir -p "$PROJECT_PATH/.resources/workflows"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/app/components"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/app/pages"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/server/api"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/server/routes"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/server/utils"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/shared"
mkdir -p "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/test"
ok "Directories: .tasks/ .sandboxes/ .atl/ .resources/ aoi_apps/agentic-ops-dashboard/"

if [ -f "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/package.json" ]; then
  ensure_dashboard_runtime
  info "Installing dashboard package dependencies..."
  DASHBOARD_INSTALL_DIR="$PROJECT_PATH/aoi_apps/agentic-ops-dashboard"
  DASHBOARD_INSTALL_LOG="$(mktemp)"

  run_dashboard_install() {
    if command -v corepack &>/dev/null; then
      corepack enable &>/dev/null || true
      (cd "$DASHBOARD_INSTALL_DIR" && corepack pnpm install)
      return $?
    fi

    (cd "$DASHBOARD_INSTALL_DIR" && pnpm install)
    return $?
  }

  if run_dashboard_install 2>&1 | tee "$DASHBOARD_INSTALL_LOG"; then
    if command -v corepack &>/dev/null; then
      ok "Dashboard dependencies installed (corepack pnpm)"
    else
      ok "Dashboard dependencies installed (pnpm)"
    fi
  else
    if grep -q "ERR_PNPM_IGNORED_BUILDS" "$DASHBOARD_INSTALL_LOG"; then
      warn "pnpm blocked dependency build scripts; approving known builds and retrying..."
      if (cd "$DASHBOARD_INSTALL_DIR" && pnpm approve-builds --all) && run_dashboard_install 2>&1 | tee "$DASHBOARD_INSTALL_LOG"; then
        ok "Dashboard dependencies installed after approving build scripts"
      else
        err "Dashboard dependency install failed after approve-builds retry"
        rm -f "$DASHBOARD_INSTALL_LOG"
        exit 1
      fi
    else
      err "Dashboard dependency install failed"
      rm -f "$DASHBOARD_INSTALL_LOG"
      exit 1
    fi
  fi

  rm -f "$DASHBOARD_INSTALL_LOG"
fi

# Patch .vscode/settings.json — replace __LOCAL_BIN__ placeholder with real user home
# Also handles the case where the project already had a settings.json (rsync skipped ours)
LOCAL_BIN="$HOME/.local/bin"
VSCODE_SETTINGS="$PROJECT_PATH/.vscode/settings.json"
HOMEBREW_PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$LOCAL_BIN:/usr/bin:/bin:/usr/sbin:/sbin"

if [ -f "$VSCODE_SETTINGS" ]; then
  if grep -q "__LOCAL_BIN__" "$VSCODE_SETTINGS"; then
    # Scaffold settings.json was copied — patch the placeholder
    sed -i '' "s|__LOCAL_BIN__|$LOCAL_BIN|g" "$VSCODE_SETTINGS"
    ok "PATH configured in .vscode/settings.json"
  elif ! grep -q "terminal.integrated.env.osx" "$VSCODE_SETTINGS"; then
    # Pre-existing settings.json without PATH config — inject both keys via Python merge
    python3 - "$VSCODE_SETTINGS" "$HOMEBREW_PATH" <<'PYEOF'
import sys, json

settings_path = sys.argv[1]
path_value = sys.argv[2]

with open(settings_path, "r") as f:
    settings = json.load(f)

settings.setdefault("terminal.integrated.env.osx", {})["PATH"] = path_value
settings["terminal.integrated.automationProfile.osx"] = {"path": "/bin/zsh", "args": ["-l"]}

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=4)
    f.write("\n")
PYEOF
    ok "PATH + automationProfile injected into existing .vscode/settings.json"
  elif ! grep -q "automationProfile" "$VSCODE_SETTINGS"; then
    # Has env.osx but missing automationProfile — add it
    python3 - "$VSCODE_SETTINGS" <<'PYEOF'
import sys, json

settings_path = sys.argv[1]

with open(settings_path, "r") as f:
    settings = json.load(f)

settings["terminal.integrated.automationProfile.osx"] = {"path": "/bin/zsh", "args": ["-l"]}

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=4)
    f.write("\n")
PYEOF
    ok "automationProfile added to .vscode/settings.json"
  else
    ok "PATH already configured in .vscode/settings.json (skipped)"
  fi
else
  mkdir -p "$PROJECT_PATH/.vscode"
  cat > "$VSCODE_SETTINGS" <<EOF
{
    "terminal.integrated.env.osx": {
        "PATH": "$HOMEBREW_PATH"
    },
    "terminal.integrated.automationProfile.osx": {
        "path": "/bin/zsh",
        "args": ["-l"]
    }
}
EOF
  ok "Created .vscode/settings.json with PATH + automationProfile"
fi

VSCODE_MCP="$PROJECT_PATH/.vscode/mcp.json"
cat > "$VSCODE_MCP" <<'EOF'
{
  "servers": {
    "icm": {
      "type": "stdio",
      "command": "bash",
      "args": ["${workspaceFolder}/.github/scripts/icm-serve.sh"]
    }
  }
}
EOF
ok "Workspace MCP configured in .vscode/mcp.json"

# ── Phase 4: Configure Tools ────────────────────────────────────────────
header "Phase 4: Tool Configuration"

cd "$PROJECT_PATH"

# RTK for Copilot — generates .github/hooks/rtk-rewrite.json + copilot-instructions.md
if command -v rtk &>/dev/null; then
  # Use scaffold version (has PATH-safe wrapper) instead of rtk init output
  # rtk init --copilot would overwrite our wrapper with a direct `rtk hook copilot` call
  ok "RTK → Copilot hooks (scaffold)"
  # Ensure the hook wrapper is executable
  chmod +x "$PROJECT_PATH/.github/scripts/rtk-hook.sh" 2>/dev/null || true
  chmod +x "$PROJECT_PATH/.github/scripts/icm-hook.sh" 2>/dev/null || true
else
  warn "RTK not found — Copilot hook will pass commands through until rtk is installed"
fi

# ICM — workspace MCP is local; remaining init modes enrich the toolchain
require_icm
ok "ICM → Workspace MCP registered (.vscode/mcp.json)"
icm init --mode hook 2>/dev/null && ok "ICM → Hooks installed (auto-extraction)" || warn "ICM hooks skipped"
icm init --mode skill 2>/dev/null && ok "ICM → Skills installed" || warn "ICM skills skipped"
icm init --mode cli 2>/dev/null && ok "ICM → CLI instructions" || warn "ICM CLI instructions skipped"
# Remove tools we don't use (icm init --mode cli installs for all tools indiscriminately)
rm -f "$PROJECT_PATH/.windsurfrules" 2>/dev/null && warn "Removed .windsurfrules (Windsurf not in use)" || true
# Ensure icm-serve.sh is executable (needed for GUI apps like Antigravity that inherit limited PATH)
chmod +x "$PROJECT_PATH/.github/scripts/icm-serve.sh" 2>/dev/null || true
chmod +x "$PROJECT_PATH/.github/scripts/icm-hook.sh" 2>/dev/null || true

# ── Phase 5: Persist Initial Context in ICM ──────────────────────────────
header "Phase 5: ICM Bootstrap"

require_icm

# Memory: store initialization context (project-isolated)
icm store -t "$PROJECT_NAME-context" \
  -c "Project $PROJECT_NAME initialized with AOI (Agentic Operational Infrastructure) v3. Stack: Hub-and-Spoke orchestration, SDD lifecycle (spec-kit), ICM persistence (4 methods: memories, memoirs, feedback, transcripts), RTK token optimization. Dual-sync enforced: Copilot (.github/agents/) ↔ Antigravity (.agent/skills/agents/). Task artifacts in .tasks/{feature}/TASK-YYYY-NNN/. Skill registry at .atl/skill-registry.md." \
  -i critical \
  -k "init,aoi,architecture" 2>/dev/null && ok "Memory: init context stored (topic: $PROJECT_NAME-context)"

# Memoir: create project architecture knowledge graph (project-isolated)
icm memoir create -n "$PROJECT_NAME-architecture" \
  -d "Architecture decisions and component relationships for $PROJECT_NAME" 2>/dev/null && ok "Memoir: $PROJECT_NAME-architecture created"

icm memoir add-concept -m "$PROJECT_NAME-architecture" -n "sdd-lifecycle" \
  -d "Spec-Driven Development lifecycle: constitution → specify → plan → tasks → implement → verify → archive" \
  -l "type:process,domain:workflow" 2>/dev/null || true

icm memoir add-concept -m "$PROJECT_NAME-architecture" -n "hub-and-spoke" \
  -d "Supervisor orchestrates specialized agents per SDD phase" \
  -l "type:pattern,domain:orchestration" 2>/dev/null || true

icm memoir add-concept -m "$PROJECT_NAME-architecture" -n "dual-sync" \
  -d "All agents/skills must exist in both Copilot (.github/agents/) and Antigravity (.agent/skills/agents/) formats" \
  -l "type:constraint,domain:sync" 2>/dev/null || true

icm memoir link -m "$PROJECT_NAME-architecture" \
  --from "hub-and-spoke" --to "sdd-lifecycle" -r depends_on 2>/dev/null || true

icm memoir link -m "$PROJECT_NAME-architecture" \
  --from "dual-sync" --to "hub-and-spoke" -r related_to 2>/dev/null || true

ok "Memoir: architecture graph bootstrapped"

# ── Phase 6: Base-Project Map (pre-seed only) ─────────────────────────────
header "Phase 6: Base-Project Map"

# Pre-seed a base-project roots PROPOSAL by running the detector. This NEVER
# writes .specify/memory/base-project.json — the confirmed write happens in
# /init after the Owner approves/corrects the proposal.
BASE_MAP_DETECTOR="$PROJECT_PATH/scripts/sandbox/detect-base-project.mjs"
if command -v node &>/dev/null && [ -f "$BASE_MAP_DETECTOR" ]; then
  info "Detecting base-project roots (proposal only, not written)..."
  if BASE_MAP_PROPOSAL="$(cd "$PROJECT_PATH" && node "$BASE_MAP_DETECTOR" 2>/dev/null)"; then
    echo "$BASE_MAP_PROPOSAL"
    ok "Base-project map proposed — confirm + write it in /init"
  else
    warn "Base-project detector failed — run /init to detect + confirm the map"
  fi
else
  warn "node or detector missing — base-project map will be detected in /init"
fi

# ── Done ─────────────────────────────────────────────────────────────────
header "Installation Complete"

echo "  Project: $PROJECT_PATH"
echo ""
echo "  Tools installed:"
command -v rtk     &>/dev/null && echo "    ✓ RTK   $(rtk --version 2>/dev/null || echo '')" || echo "    ✗ RTK"
command -v icm     &>/dev/null && echo "    ✓ ICM   $(icm --version 2>/dev/null || echo '')" || echo "    ✗ ICM"
command -v specify &>/dev/null && echo "    ✓ Specify CLI" || echo "    ✗ Specify CLI"
echo ""
echo "  Next steps:"
echo "    1. cd $PROJECT_PATH && code ."
echo "    2. Run /init in Copilot Chat (bootstrap ICM, directories, base-project map)"
echo "    3. (optional) Run /speckit.constitution to customize project rules"
echo "    4. Start your first cycle: /sdd-new"
if [ -f "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/package.json" ]; then
  echo "    5. Start the dashboard runtime: pnpm --dir aoi_apps/agentic-ops-dashboard dev"
fi
echo ""
