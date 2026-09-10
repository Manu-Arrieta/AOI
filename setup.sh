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

# Files kept because the Owner had changed them; reported at the end of the run.
HARNESS_KEPT=""

# Removes one harness path, but ONLY the parts of it that AOI itself shipped.
#
# The three-way merge is safe because its comparator walks the SCAFFOLD, never
# the project: a file the Owner created is never visited, so it cannot be
# touched. This pruning used to bypass that entirely with `rm -f` / `rm -rf`,
# which is the same shape as the `aoi_apps` incident — it deleted a customised
# CLAUDE.md, an edited AGENTS.md and Owner-authored skills under `.agents/`
# with no backup, no conflict entry and no mention in the run summary.
#
# So the rule here is the merge's rule: delete a file only when it is
# byte-identical to what the scaffold shipped. Anything edited, and anything
# AOI never shipped at all, stays and is reported.
prune_path_if_pristine() {
  local target="$1"
  local reference="$2"

  [ -e "$target" ] || return 0

  if [ -f "$target" ]; then
    if [ -f "$reference" ] && cmp -s "$target" "$reference"; then
      rm -f "$target"
    else
      HARNESS_KEPT="$HARNESS_KEPT
  $target"
    fi
    return 0
  fi

  # A directory is pruned file by file. Owner-authored files inside it have no
  # counterpart in the scaffold and therefore survive, and the directory itself
  # only disappears once nothing of the Owner's is left in it.
  local file rel
  while IFS= read -r file || [ -n "$file" ]; do
    [ -n "$file" ] || continue
    rel="${file#$target/}"
    prune_path_if_pristine "$file" "$reference/$rel"
  done <<EOF
$(find "$target" -type f 2>/dev/null)
EOF

  find "$target" -type d -empty -delete 2>/dev/null || true
}

prune_unselected_harness_files() {
  local target_dir="$1"
  local selected_harness="$2"
  local ref="${3:-$SCAFFOLD_DIR}"

  if [ -z "$selected_harness" ] || [ "$selected_harness" = "all" ]; then
    return 0
  fi

  if [ "$selected_harness" != "claude" ]; then
    prune_path_if_pristine "$target_dir/CLAUDE.md" "$ref/CLAUDE.md"
  fi

  if [ "$selected_harness" != "cursor" ]; then
    prune_path_if_pristine "$target_dir/.cursorrules" "$ref/.cursorrules"
    prune_path_if_pristine "$target_dir/.cursor" "$ref/.cursor"
  fi

  if [ "$selected_harness" != "antigravity" ]; then
    prune_path_if_pristine "$target_dir/AGENTS.md" "$ref/AGENTS.md"
    prune_path_if_pristine "$target_dir/.agents" "$ref/.agents"
  fi

  if [ "$selected_harness" != "cline" ]; then
    prune_path_if_pristine "$target_dir/.clinerules" "$ref/.clinerules"
  fi

  if [ "$selected_harness" != "copilot" ]; then
    prune_path_if_pristine "$target_dir/.github/copilot-instructions.md" "$ref/.github/copilot-instructions.md"
  fi
}

# Prints what the pruning refused to delete. Silence here is a real signal:
# it means every harness file removed was untouched AOI content.
report_harness_kept() {
  [ -n "$HARNESS_KEPT" ] || return 0
  warn "Harness pruning kept these because you had changed them:$HARNESS_KEPT"
  warn "They belong to a harness you did not select. Delete them yourself if you want them gone."
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
  local tmp_base
  tmp_base="$(mktemp "$source_dir/aoi-setup-XXXXXX" 2>/dev/null || mktemp)"
  target_path="${tmp_base}.ps1"
  stage_path="${tmp_base}.stage"
  touch "$target_path" "$stage_path"
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
  # Use python3 -c (without stdin pipe) or perl if available; otherwise skip.
  if command -v python3 &>/dev/null && python3 -c 'import sys' 2>/dev/null && [ -s "$stage_path" ]; then
    python3 -c '
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
try:
    with open(stage, "rb") as f:
        data = f.read().decode("utf-8", errors="replace")
    with open(stage, "wb") as f:
        f.write(data.translate(table).encode("utf-8"))
except Exception:
    pass
' "$stage_path" 2>/dev/null || true
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
  shift 3
  local extra_args=("$@")
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
          "$bin" -NoProfile -ExecutionPolicy Bypass -File "$tmp_windows" -ProjectPath "$windows_project_path" "${extra_args[@]}"
          local rc=$?
          rm -f "$tmp_posix"
          return $rc
          ;;
        *)
          "$bin" -NoProfile -File "$windows_script_path" -ProjectPath "$windows_project_path" "${extra_args[@]}"
          return $?
          ;;
      esac
    fi
  done

  err "Git Bash on Windows requires powershell.exe, powershell, or pwsh to run setup.ps1."
  return 127
}

run_windows_setup_from_git_bash() {
  local project_path=""
  local harness_choice="all"
  local auto_yes=0
  local skip_dashboard_deps=0
  local posix_script_path windows_project_path windows_script_path ps_exit_code ps_stderr saw_parser_error

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -y|--yes|--non-interactive)
        auto_yes=1
        shift
        ;;
      --skip-dashboard-deps|--no-dashboard-deps)
        skip_dashboard_deps=1
        shift
        ;;
      --harness)
        harness_choice="$2"
        shift 2
        ;;
      --harness=*)
        harness_choice="${1#*=}"
        shift
        ;;
      *)
        if [ -z "$project_path" ]; then
          project_path="$1"
        fi
        shift
        ;;
    esac
  done

  if [ -z "$project_path" ]; then
    printf "📂 Project path to install AOI into:\n> "
    read -r project_path
  fi

  # Strip surrounding quotes if user entered them
  project_path="${project_path#\"}"
  project_path="${project_path%\"}"
  project_path="${project_path#\'}"
  project_path="${project_path%\'}"

  # Expand ~ if provided
  project_path="${project_path/#\~/$HOME}"

  if [ ! -d "$project_path" ]; then
    err "Directory not found: $project_path"
    exit 1
  fi

  posix_script_path="$SCRIPT_DIR/setup.ps1"

  if ! windows_script_path="$(to_windows_path "$posix_script_path")"; then
    err "Git Bash on Windows requires cygpath to delegate to setup.ps1."
    exit 1
  fi

  if ! windows_project_path="$(to_windows_path "$project_path")"; then
    err "Could not convert project path for Windows PowerShell: $project_path"
    exit 1
  fi

  info "Git Bash on Windows detected — delegating to setup.ps1 (harness: $harness_choice)"

  local extra_ps_args=("-Harness" "$harness_choice")
  if [ "$auto_yes" -eq 1 ]; then
    extra_ps_args+=("-Yes")
  fi
  if [ "$skip_dashboard_deps" -eq 1 ]; then
    extra_ps_args+=("-SkipDashboardDeps")
  fi

  invoke_windows_powershell "$posix_script_path" "$windows_script_path" "$windows_project_path" "${extra_ps_args[@]}"
  ps_exit_code=$?
  if [ "$ps_exit_code" -eq 0 ]; then
    ok "AOI setup completed successfully for $project_path"
    exit 0
  fi

  warn "PowerShell exited with code $ps_exit_code"
  warn "If you need a narrower diagnosis, run directly from native PowerShell:"
  warn "  powershell -NoProfile -ExecutionPolicy Bypass -File .\\setup.ps1 -ProjectPath \"$windows_project_path\""
  exit $ps_exit_code
}

if is_windows_git_bash; then
  run_windows_setup_from_git_bash "$@"
fi

# ── Parse arguments ────────────────────────────────────────────────────────
# Exportada: snapshot-conf.sh corre como subproceso y sin export leía siempre
# el default. La persistencia del harness en .conf/manifest.json — que era la
# mitad del arreglo de G0, la que permite avisar cuando un reinstall cambia de
# harness — por lo tanto nunca funcionó: el manifest registraba "all" pasara lo
# que pasara.
export SELECTED_HARNESS="all"
RAW_PROJECT_PATH=""
AUTO_YES=0
SKIP_DASHBOARD_DEPS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes|--non-interactive)
      AUTO_YES=1
      shift
      ;;
    --skip-dashboard-deps|--no-dashboard-deps)
      SKIP_DASHBOARD_DEPS=1
      shift
      ;;
    --harness)
      SELECTED_HARNESS="$2"
      shift 2
      ;;
    --harness=*)
      SELECTED_HARNESS="${1#*=}"
      shift
      ;;
    *)
      if [ -z "$RAW_PROJECT_PATH" ]; then
        RAW_PROJECT_PATH="$1"
      fi
      shift
      ;;
  esac
done

# ── Target project path ────────────────────────────────────────────────────
if [ -n "$RAW_PROJECT_PATH" ]; then
  PROJECT_PATH="$RAW_PROJECT_PATH"
else
  printf "📂 Project path to install AOI into:\n> "
  read -r PROJECT_PATH
fi

# Interactive harness selection if running in TTY without explicit harness flag and not auto-yes
if [ -t 0 ] && [ "$AUTO_YES" -eq 0 ] && [ "$SELECTED_HARNESS" = "all" ] && [ -z "$RAW_PROJECT_PATH" ]; then
  echo ""
  echo "🤖 Choose target AI assistant(s) for rule compilation:"
  echo "  1) Universal / All (Copilot, Claude, Cursor, Antigravity, Cline) [Default]"
  echo "  2) GitHub Copilot only"
  echo "  3) Claude Code only"
  echo "  4) Cursor only"
  echo "  5) Antigravity / Gemini only"
  echo "  6) Cline / Roo Code only"
  printf "Select [1-6] (default 1): "
  read -r H_CHOICE
  case "$H_CHOICE" in
    2) SELECTED_HARNESS="copilot" ;;
    3) SELECTED_HARNESS="claude" ;;
    4) SELECTED_HARNESS="cursor" ;;
    5) SELECTED_HARNESS="antigravity" ;;
    6) SELECTED_HARNESS="cline" ;;
    *) SELECTED_HARNESS="all" ;;
  esac
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

# ── Phase 1: Install Tools (RTK and ICM both mandatory) ────────────────
header "Phase 1: Tools"

install_rtk() {
  if command -v rtk &>/dev/null; then
    CURRENT_VER="$(rtk --version 2>/dev/null || echo 'unknown')"
    if [ "$AUTO_YES" -eq 1 ] || ! [ -t 0 ]; then
      CHOICE="k"
    else
      printf "${YELLOW}▸${NC} RTK already installed (%s). [U]pdate / [K]eep? [k]: " "$CURRENT_VER"
      read -r CHOICE
    fi
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
    if [ "$AUTO_YES" -eq 1 ] || ! [ -t 0 ]; then
      CHOICE="k"
    else
      printf "${YELLOW}▸${NC} ICM already installed (%s). [U]pdate / [K]eep? [k]: " "$CURRENT_VER"
      read -r CHOICE
    fi
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

# RTK is mandatory for the same reason ICM is: it is not a convenience, it is
# one of the mechanisms the product's savings claim rests on.
require_rtk() {
  if command -v rtk &>/dev/null; then
    return 0
  fi

  err "RTK is mandatory. Installation cannot continue without a working rtk command."
  err "Install it (brew install rtk-ai/tap/rtk) and rerun setup.sh."
  exit 1
}

# The MCP compression proxy — the mechanism Invariant 1 names as the source of
# its savings, and which until now existed only as a config file describing a
# proxy nobody installed.
#
# Distribution matters here. The npm package `@atlassian/mcp-compressor` is a
# thin wrapper that delegates to a Rust binary it does not ship: it prints
# "binary was not found … build it with cargo" AND EXITS 0, so a naive check
# would read that failure as success. There are no prebuilt binaries in the
# GitHub releases either. The Python distribution carries the compiled binary,
# and AOI already requires `uv`, so that is the route.
install_mcp_compressor() {
  if command -v mcp-compressor &>/dev/null && mcp-compressor --version &>/dev/null; then
    ok "MCP compressor present ($(mcp-compressor --version 2>/dev/null))"
    return 0
  fi

  command -v uv &>/dev/null || return 1
  uv tool install mcp-compressor >/dev/null 2>&1 || return 1
  command -v mcp-compressor &>/dev/null || return 1
  ok "MCP compressor installed ($(mcp-compressor --version 2>/dev/null))"
}

# Verified by running it, not by asking whether the command resolves: the npm
# wrapper resolves fine and still cannot compress anything.
require_mcp_compressor() {
  if mcp-compressor --version &>/dev/null; then
    return 0
  fi

  err "mcp-compressor is mandatory: it is the proxy Invariant 1 rests on."
  err "Install it with 'uv tool install mcp-compressor' and rerun setup.sh."
  err "Do NOT install the npm package: it ships no binary and exits 0 while failing."
  exit 1
}

get_codebase_memory_path() {
  local resolved_path

  resolved_path="$(command -v codebase-memory-mcp 2>/dev/null || true)"
  if [[ -n "$resolved_path" ]]; then
    printf '%s' "$resolved_path"
    return 0
  fi

  resolved_path="$HOME/.local/bin/codebase-memory-mcp"
  if [[ -x "$resolved_path" ]]; then
    printf '%s' "$resolved_path"
    return 0
  fi

  return 1
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
#
# Every token-saving tool is mandatory. Headroom is the one exception, and it
# stays optional in Phase 1.6. RTK used to be installed best-effort and the run
# continued on failure with a warning, which meant an installation could end up
# advertising 60-90% savings on shell output while running every command
# unfiltered. A saving the product cannot guarantee is not a saving.
if ! install_rtk; then
  err "RTK is mandatory: it is the proxy that keeps command output out of the context."
  err "Install it manually (brew install rtk-ai/tap/rtk) and rerun setup.sh."
  exit 1
fi
require_rtk
install_icm
require_icm
install_uv
# After uv, because the compressor's working distribution is the Python one.
if ! install_mcp_compressor; then
  err "mcp-compressor install failed. It is the proxy that keeps MCP tool"
  err "schemas out of the context — measured at -83% on this toolset."
  err "Install it manually ('uv tool install mcp-compressor') and rerun setup.sh."
  exit 1
fi
require_mcp_compressor
install_specify || true

# ── Phase 1.5: Optional NVIDIA customendpoint helper (non-blocking) ────────
header "Phase 1.5: NVIDIA customendpoint (opcional)"

if [[ -f "$SCRIPT_DIR/scripts/nvidia-vscode-setup.sh" ]]; then
  info "Detectando VS Code para configurar custom endpoint NVIDIA (Kimi K2.6, DeepSeek V4 Pro, MiniMax M3, Qwen 3.5)"
  info "Presione Enter para ejecutar ahora, o 'n' + Enter para omitir (AOI seguirá funcionando con defaults vendor-copilot)."
  if [ "$AUTO_YES" -eq 1 ] || ! [ -t 0 ]; then
    NVIDIA_CHOICE="n"
  else
    printf "${YELLOW}▸${NC} Configurar customendpoint NVIDIA? [Y/n]: "
    read -r NVIDIA_CHOICE
  fi
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

# ── Phase 1.6: Headroom (headroom-ai) compression layer (optional) ────────
header "Phase 1.6: Headroom compression layer (opcional)"

if [[ -f "$SCRIPT_DIR/scripts/install-headroom.sh" ]]; then
  info "Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library para reducir"
  info "tokens 60-95% en flujos CLI (Claude Code, Codex, gh copilot). NO intercepta VS Code"
  info "Copilot Chat (extensión nativa). Para ese contexto el ahorro viene de RTK + codebase-memory-mcp."
  if [ "$AUTO_YES" -eq 1 ] || ! [ -t 0 ]; then
    HEADROOM_CHOICE="n"
  else
    printf "${YELLOW}▸${NC} Instalar Headroom? [Y/n]: "
    read -r HEADROOM_CHOICE
  fi
  case "$HEADROOM_CHOICE" in
    n|N|no|NO)
      warn "Headroom omitido. AOI continúa sin capa de compresión CLI."
      ;;
    *)
      bash "$SCRIPT_DIR/scripts/install-headroom.sh" --yes || {
        ret=$?
        warn "install-headroom.sh salió con código $ret — el setup continúa sin Headroom."
        warn "El operador puede reintentar luego: bash scripts/install-headroom.sh --yes"
      }
      if command -v headroom &>/dev/null && [[ -f "$SCRIPT_DIR/scripts/headroom-vscode-setup.sh" ]]; then
        info "Headroom se configura por envvars (NO modifica VS Code)."
        bash "$SCRIPT_DIR/scripts/headroom-vscode-setup.sh" || {
          warn "headroom-vscode-setup.sh falló — el setup continúa. Configurá las envvars manualmente."
        }
        ok "Headroom instalado y configurado ($(headroom --version 2>/dev/null || echo 'version check pending'))"
      fi
      ;;
  esac
else
  warn "scripts/install-headroom.sh no encontrado junto a setup.sh — saltando Phase 1.6"
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

# Both files are governed and both travel inside the scaffold, so the merge
# below already owns them. They are seeded here only because this phase wires
# the hook and the wrapper, which run earlier than the merge and need the file
# to exist.
#
# Seeded, not overwritten. A plain `cp` here wrote AOI's version over the
# owner's BEFORE the comparator read the tree, so the comparator saw its own
# installer's bytes, found them different from the recorded baseline, and
# blamed the owner: a CONFLICT on a file nobody had touched. Reproduced on the
# real installation — `.githooks/pre-commit-aoi-guard.sh` landed in
# .conf/conflicts/ on a workspace whose owner had never opened it.
install_governed_seed() {
  local src="$1" dest="$2" label="$3"
  if [ -f "$dest" ]; then
    ok "$label ya presente — lo resuelve el merge (no se pisa)"
  else
    cp "$src" "$dest"
    ok "Installed $label"
  fi
  chmod +x "$dest"
}

install_governed_seed "$WRAP_SRC" "$PROJECT_PATH/scripts/aoi-headroom-wrap.sh" "aoi-headroom-wrap.sh → PROJECT/scripts/"
install_governed_seed "$GUARD_SRC" "$PROJECT_PATH/.githooks/pre-commit-aoi-guard.sh" "pre-commit-aoi-guard.sh → PROJECT/.githooks/"

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

# Wire the guard as `commit-msg`, chaining any hook the project already had.
#
# It used to be wired as `pre-commit`, and that is the one hook which cannot
# do this job: git writes the message only after pre-commit succeeds, so the
# guard read the PREVIOUS commit's subject. The `[aoi-managed-ok]` override its
# own error message instructs the operator to use was therefore inoperative,
# and its `git log -1` fallback approved today's diff whenever yesterday's
# commit happened to carry the marker. `commit-msg` receives the message file
# as $1, the index is already final there, and a non-zero exit still aborts.
HOOKS_DIR="$PROJECT_PATH/.git/hooks"
PROJECT_GITHOOK="$HOOKS_DIR/commit-msg"
if [[ -d "$PROJECT_PATH/.git" ]]; then
  mkdir -p "$HOOKS_DIR"

  # Retire the pre-commit wiring a previous AOI left behind. Left in place it
  # blocks first, before commit-msg ever runs, so the override would stay
  # unreachable no matter how correct the new hook is. Only OUR hook is
  # touched: one the operator wrote is left exactly as it is.
  OLD_PRECOMMIT="$HOOKS_DIR/pre-commit"
  if [[ -f "$OLD_PRECOMMIT" ]] && grep -q "pre-commit-aoi-guard.sh" "$OLD_PRECOMMIT"; then
    if [[ -f "$HOOKS_DIR/pre-commit.aoi-bak" ]]; then
      mv "$HOOKS_DIR/pre-commit.aoi-bak" "$OLD_PRECOMMIT"
      ok "Restaurado el pre-commit propio del proyecto (el guard se movió a commit-msg)"
    else
      rm -f "$OLD_PRECOMMIT"
      ok "Retirado el guard de pre-commit (se movió a commit-msg, donde el marcador funciona)"
    fi
  fi

  if [[ -f "$PROJECT_GITHOOK" ]]; then
    if ! grep -q "pre-commit-aoi-guard.sh" "$PROJECT_GITHOOK"; then
      cp "$PROJECT_GITHOOK" "$PROJECT_GITHOOK.aoi-bak"
      cat > "$PROJECT_GITHOOK" <<'EOF_COMMITMSG'
#!/usr/bin/env bash
# AOI bootstrap chain: run guard first, then delegate to project commit-msg.
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$SELF_DIR/../../.githooks/pre-commit-aoi-guard.sh" "$@" || exit $?
if [ -f "$SELF_DIR/commit-msg.aoi-bak" ]; then
  exec bash "$SELF_DIR/commit-msg.aoi-bak" "$@"
fi
exit 0
EOF_COMMITMSG
      chmod +x "$PROJECT_GITHOOK"
      ok "Chained AOI guard into existing commit-msg hook"
    else
      ok "AOI guard already chained into commit-msg (skipped)"
    fi
  else
    cp "$GUARD_SRC" "$PROJECT_GITHOOK"
    chmod +x "$PROJECT_GITHOOK"
    ok "Installed AOI guard → .git/hooks/commit-msg"
  fi
else
  info "Target project is not a git repo — AOI guard will activate once 'git init' runs."
  info "    When ready, run: ln -sf ../../.githooks/pre-commit-aoi-guard.sh .git/hooks/commit-msg"
fi

# ── Phase 1.8: codebase-memory-mcp (MANDATORY, workspace-local only) ───────
header "Phase 1.8: Codebase Memory MCP (obligatorio)"

if [[ -f "$SCRIPT_DIR/scripts/install-codebase-memory.sh" ]]; then
  info "codebase-memory-mcp indexa el repo en un knowledge graph local para reducir"
  info "exploración file-by-file. AOI lo instala con --skip-config para NO tocar"
  info "copilot-instructions.md del operador y registra el MCP sólo en el workspace actual."
  # Mandatory, like RTK and ICM: it is one of the mechanisms that keeps
  # exploration out of the context. It used to default to "n" whenever stdin
  # was not a TTY, which silently disabled it in every automated install —
  # exactly the installs that never get a human to reconsider.
  CBM_CHOICE="y"
  case "$CBM_CHOICE" in
    n|N|no|NO)
      warn "codebase-memory-mcp omitido."
      ;;
    *)
      info "Variante UI incluye grafo 3D interactivo en http://localhost:9749"
      if [ "$AUTO_YES" -eq 1 ] || ! [ -t 0 ]; then
        CBM_UI_CHOICE="n"
      else
        printf "${YELLOW}▸${NC} Instalar variante con UI (recomendado)? [Y/n]: "
        read -r CBM_UI_CHOICE
      fi
      CBM_VARIANT_FLAG="--ui"
      case "$CBM_UI_CHOICE" in
        n|N|no|NO) CBM_VARIANT_FLAG="--standard" ;;
      esac
      bash "$SCRIPT_DIR/scripts/install-codebase-memory.sh" --yes $CBM_VARIANT_FLAG || {
        ret=$?
        warn "install-codebase-memory.sh salió con código $ret — el setup continúa."
        warn "El operador puede reintentar luego; el MCP workspace-local quedará en ICM only."
      }
      # Post-install config: enable auto_index (native git watcher) and UI
      CBM_BIN_INIT="$(command -v codebase-memory-mcp 2>/dev/null || true)"
      if [[ -n "$CBM_BIN_INIT" ]]; then
        "$CBM_BIN_INIT" config set auto_index true 2>/dev/null && ok "codebase-memory-mcp: auto_index activado (watcher nativo de git)" || true
        if [[ "$CBM_VARIANT_FLAG" == "--ui" ]]; then
          "$CBM_BIN_INIT" config set ui true 2>/dev/null && ok "codebase-memory-mcp: UI activada en http://localhost:9749" || true
          "$CBM_BIN_INIT" config set port 9749 2>/dev/null || true
        fi
        # Initial index — runs in background, non-blocking. auto_index handles subsequent changes.
        info "Indexando el repo por primera vez en background (codebase-memory-mcp)..."
        "$CBM_BIN_INIT" cli index_repository "{\"repo_path\": \"$PROJECT_PATH\"}" \
          >> /tmp/codebase-memory-mcp-index.log 2>&1 &
        ok "Index inicial lanzado en background → /tmp/codebase-memory-mcp-index.log"
      fi
      ;;
  esac
else
  warn "scripts/install-codebase-memory.sh no encontrado junto a setup.sh — saltando Phase 1.8"
fi

# Reinstall is detected HERE, before spec-kit runs, because that decision
# changes what Phase 2 is allowed to do to an existing workspace.
IS_REINSTALL=0
if [ -f "$PROJECT_PATH/.conf/manifest.json" ]; then
  IS_REINSTALL=1
fi

# ── Phase 2: Initialize Spec-Kit ──────────────────────────────────────────
header "Phase 2: Spec-Kit"

cd "$PROJECT_PATH"

if [ "$IS_REINSTALL" -eq 1 ]; then
  # `specify init --force` overwrites .github/ and .specify/ wholesale. On a
  # first install that is exactly what we want. On a reinstall it is pure
  # destruction: AOI's scaffold already owns every artifact spec-kit writes
  # (28 speckit files under .github/, 41 under .specify/), so the smart merge
  # below reinstates them anyway — but only AFTER spec-kit has already
  # flattened whatever the workspace had, which destroys the very information
  # the three-way merge needs to tell an AOI update apart from a user edit.
  info "Reinstall detected — skipping 'specify init --force' (AOI's scaffold owns these artifacts)"
elif command -v specify &>/dev/null; then
  info "Initializing spec-kit for Copilot..."
  specify init . --ai copilot --force 2>/dev/null && ok "Spec-kit → Copilot" || warn "Spec-kit Copilot init skipped (may need manual setup)"

else
  warn "Specify CLI not found — skipping spec-kit init"
  warn "Run manually after installing: specify init . --ai copilot --force"
fi

# ── Phase 3: Copy Agentic Scaffold ───────────────────────────────────────
header "Phase 3: Agentic Infrastructure"

cd "$PROJECT_PATH"

CONF_SCRIPTS_DIR="$SCRIPT_DIR/scripts/conf"
REINSTALL_STATS_UPDATED=0
REINSTALL_STATS_CONFLICTS=0
REINSTALL_STATS_NEW=0
REINSTALL_STATS_SKIPPED=0
REINSTALL_STATS_ORPHANS=0
REINSTALL_STATS_ORPHANS_KEPT=0

# IS_REINSTALL was resolved before Phase 2 — see the note there.
if [ "$IS_REINSTALL" -eq 1 ]; then
  info "Detected previous installation (.conf/manifest.json) — entering REINSTALL mode"

  # A reinstall that switches harness prunes the files of the one being left
  # behind. That used to happen in silence and with no memory of the earlier
  # choice, because the manifest never recorded it. Now it does, so the change
  # can at least be named out loud before anything is removed.
  PREV_HARNESS="$(sed -n 's/.*"selected_harness"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    "$PROJECT_PATH/.conf/manifest.json" 2>/dev/null | head -1)"
  if [ -n "$PREV_HARNESS" ] && [ "$PREV_HARNESS" != "$SELECTED_HARNESS" ]; then
    warn "Harness change: this workspace was installed as '$PREV_HARNESS', now installing as '$SELECTED_HARNESS'."
    warn "Files belonging to '$PREV_HARNESS' will be pruned — but only the ones you never edited."
  fi

  # ── 3a: Cleanup stale/corrupted files from previous installs ───────────
  # Removes files with doubled extensions (*.agent.agent.md, *.instructions.instructions.md, etc.)
  # that may have been created by bugs in older AOI versions. Safe: only deletes if correct counterpart exists.
  STALE_COUNT=0
  for STALE_PATTERN in "*.agent.agent.md" "*.instructions.instructions.md" "*.skill.skill.md" "*.prompt.prompt.md"; do
    while IFS= read -r -d '' stale_file; do
      CORRECT_NAME="${stale_file/.agent.agent.md/.agent.md}"
      CORRECT_NAME="${CORRECT_NAME/.instructions.instructions.md/.instructions.md}"
      CORRECT_NAME="${CORRECT_NAME/.skill.skill.md/.skill.md}"
      CORRECT_NAME="${CORRECT_NAME/.prompt.prompt.md/.prompt.md}"
      if [ "$stale_file" != "$CORRECT_NAME" ] && [ -f "$CORRECT_NAME" ]; then
        rm -f "$stale_file" && STALE_COUNT=$((STALE_COUNT + 1))
      fi
    done < <(find "$PROJECT_PATH/.github" -name "$STALE_PATTERN" -type f -print0 2>/dev/null || true)
  done
  if [ "$STALE_COUNT" -gt 0 ]; then
    ok "Cleaned up $STALE_COUNT stale/corrupted file(s) from previous install"
  fi

  # ── 3b: Smart merge for every governed file, aoi_apps/ included ─────────
  if [ -f "$CONF_SCRIPTS_DIR/compare-install.sh" ]; then
    COMPARE_STDERR="$(mktemp)"
    # The exit status is captured on its own. `|| echo '{}'` used to swallow it,
    # and `{}` is perfectly valid JSON: every list parsed empty, no file was
    # copied, no warning was printed and the run ended with "Reinstall merge
    # complete". A comparator that could not read checksums.json therefore
    # reported a successful reinstall that updated nothing.
    set +e
    COMPARE_OUTPUT="$(bash "$CONF_SCRIPTS_DIR/compare-install.sh" \
      "$SCAFFOLD_DIR" \
      "$PROJECT_PATH/.conf/checksums.json" \
      "$PROJECT_PATH" 2>"$COMPARE_STDERR")"
    COMPARE_STATUS=$?
    set -e
    if [ "$COMPARE_STATUS" -ne 0 ]; then
      warn "compare-install.sh falló (exit $COMPARE_STATUS) — SMART MERGE DESHABILITADO."
      warn "Los archivos ya presentes NO se van a actualizar en este reinstall."
      [ -s "$COMPARE_STDERR" ] && sed 's/^/    /' "$COMPARE_STDERR" >&2
      COMPARE_OUTPUT='{}'
    fi

    # Fail LOUDLY: a malformed comparison silently degrades the reinstall to
    # `rsync --ignore-existing`, which never updates an already-present file.
    # That failure mode shipped unnoticed for months on macOS (bash 3.2).
    if ! printf '%s' "$COMPARE_OUTPUT" | python3 -c "import json,sys; json.load(sys.stdin)" 2>/dev/null; then
      warn "compare-install.sh returned invalid JSON — SMART MERGE DISABLED."
      warn "Existing files will NOT be updated by this reinstall. Fix before relying on it."
      if [ -s "$COMPARE_STDERR" ]; then
        warn "  reason: $(head -2 "$COMPARE_STDERR" | tr '\n' ' ')"
      fi
      COMPARE_OUTPUT='{}'
    fi
    rm -f "$COMPARE_STDERR"

    # Parse comparison results using python3 (mandatory dependency via ICM)
    COMPARE_TMPDIR=""
    REINSTALL_STATS_UPDATED=0
    REINSTALL_STATS_CONFLICTS=0
    REINSTALL_STATS_NEW=0
    REINSTALL_STATS_SKIPPED=0
    REINSTALL_STATS_ORPHANS=0
    REINSTALL_STATS_ORPHANS_KEPT=0
    if command -v python3 &>/dev/null; then
      eval "$(python3 -c "
import json, sys, shlex
data = json.loads('''$COMPARE_OUTPUT''')
auto = data.get('auto_update', [])
conflicts = data.get('conflict', [])
new = data.get('new', [])
skip = data.get('skip', [])
orphans = data.get('orphan', [])
orphans_kept = data.get('orphan_modified', [])
print(f'REINSTALL_STATS_UPDATED={len(auto)}')
print(f'REINSTALL_STATS_CONFLICTS={len(conflicts)}')
print(f'REINSTALL_STATS_NEW={len(new)}')
print(f'REINSTALL_STATS_SKIPPED={len(skip)}')
print(f'REINSTALL_STATS_ORPHANS={len(orphans)}')
print(f'REINSTALL_STATS_ORPHANS_KEPT={len(orphans_kept)}')
# Emit file lists as newline-separated temp files
import tempfile, os
td = tempfile.mkdtemp()
for name, lst in [('auto_update', auto), ('conflict', conflicts), ('new', new), ('orphan', orphans), ('orphan_modified', orphans_kept)]:
    with open(os.path.join(td, name), 'w') as f:
        # Trailing newline is mandatory: a file whose last line is unterminated
        # makes the bash read loop return false on that line, silently dropping
        # the final entry of every list.
        f.write(''.join(f'{item}\n' for item in lst))
print(f'COMPARE_TMPDIR={td}')
" 2>/dev/null)" || true

      # Apply auto-updates (scaffold changed, user did NOT modify)
      if [ -n "$COMPARE_TMPDIR" ] && [ -f "$COMPARE_TMPDIR/auto_update" ] && [ -s "$COMPARE_TMPDIR/auto_update" ]; then
        while IFS= read -r rel_file || [ -n "$rel_file" ]; do
          [ -z "$rel_file" ] && continue
          mkdir -p "$(dirname "$PROJECT_PATH/$rel_file")"
          cp "$SCAFFOLD_DIR/$rel_file" "$PROJECT_PATH/$rel_file"
        done < "$COMPARE_TMPDIR/auto_update"
        ok "Auto-updated $REINSTALL_STATS_UPDATED file(s) (scaffold changed, user untouched)"
      fi

      if [ -z "$COMPARE_TMPDIR" ]; then
        warn "python3 smart merge produced no temp dir — falling back to rsync --ignore-existing"
        if command -v rsync &>/dev/null; then
          rsync -a --ignore-existing "$SCAFFOLD_DIR/" "$PROJECT_PATH/"
        fi
      else
        # Copy new files (exist in scaffold but not in previous install)
        if [ -f "$COMPARE_TMPDIR/new" ] && [ -s "$COMPARE_TMPDIR/new" ]; then
          while IFS= read -r rel_file || [ -n "$rel_file" ]; do
            [ -z "$rel_file" ] && continue
            mkdir -p "$(dirname "$PROJECT_PATH/$rel_file")"
            cp "$SCAFFOLD_DIR/$rel_file" "$PROJECT_PATH/$rel_file"
          done < "$COMPARE_TMPDIR/new"
          ok "Installed $REINSTALL_STATS_NEW new file(s)"
        fi

        # Remove files AOI no longer ships, but only the ones the owner never
        # touched — compare-install.sh already withheld anything edited or
        # living under .tasks/, .sandboxes/, .resources/ or .conf/. Left in
        # place, an obsolete prompt or agent stays invocable and reads as
        # current to both humans and models.
        if [ -f "$COMPARE_TMPDIR/orphan" ] && [ -s "$COMPARE_TMPDIR/orphan" ]; then
          while IFS= read -r rel_file || [ -n "$rel_file" ]; do
            [ -z "$rel_file" ] && continue
            rm -f "$PROJECT_PATH/$rel_file"
          done < "$COMPARE_TMPDIR/orphan"
          ok "Removed $REINSTALL_STATS_ORPHANS obsolete file(s) AOI no longer ships"
        fi
        if [ -f "$COMPARE_TMPDIR/orphan_modified" ] && [ -s "$COMPARE_TMPDIR/orphan_modified" ]; then
          warn "$REINSTALL_STATS_ORPHANS_KEPT obsolete file(s) kept because you modified them:"
          while IFS= read -r rel_file || [ -n "$rel_file" ]; do
            [ -z "$rel_file" ] && continue
            warn "  kept: $rel_file"
          done < "$COMPARE_TMPDIR/orphan_modified"
        fi

        # Report conflicts (both scaffold and user modified). The directory is
        # cleared first: a conflict from three reinstalls ago is indistinguishable
        # from one raised just now, and stale entries make the folder unreadable.
        if [ -f "$COMPARE_TMPDIR/conflict" ] && [ -s "$COMPARE_TMPDIR/conflict" ]; then
          rm -rf "$PROJECT_PATH/.conf/conflicts"
          mkdir -p "$PROJECT_PATH/.conf/conflicts"
          while IFS= read -r rel_file || [ -n "$rel_file" ]; do
            [ -z "$rel_file" ] && continue
            mkdir -p "$(dirname "$PROJECT_PATH/.conf/conflicts/$rel_file")"
            cp "$SCAFFOLD_DIR/$rel_file" "$PROJECT_PATH/.conf/conflicts/$rel_file"
          done < "$COMPARE_TMPDIR/conflict"
          warn "Found $REINSTALL_STATS_CONFLICTS conflict(s) — new versions saved to .conf/conflicts/"
          warn "Review and manually merge: ls .conf/conflicts/"
        fi

        if [ "$REINSTALL_STATS_SKIPPED" -gt 0 ]; then
          ok "Skipped $REINSTALL_STATS_SKIPPED unchanged file(s)"
        fi

        # ── Post-merge integrity check ────────────────────────────────────
        # Anything we just claimed to apply must now match the scaffold. This
        # matters because the snapshot below rewrites the checksum baseline
        # from the SCAFFOLD, not from what actually landed. A copy that fails
        # is therefore recorded as applied, and every later reinstall sees
        # "scaffold unchanged -> skip". The drift becomes permanent AND
        # invisible. Detecting it costs one cmp per touched file.
        MERGE_DRIFT=0
        for bucket in auto_update new; do
          [ -f "$COMPARE_TMPDIR/$bucket" ] || continue
          while IFS= read -r rel_file || [ -n "$rel_file" ]; do
            [ -z "$rel_file" ] && continue
            if ! cmp -s "$SCAFFOLD_DIR/$rel_file" "$PROJECT_PATH/$rel_file" 2>/dev/null; then
              MERGE_DRIFT=$((MERGE_DRIFT + 1))
              warn "  not applied: $rel_file"
            fi
          done < "$COMPARE_TMPDIR/$bucket"
        done
        if [ "$MERGE_DRIFT" -gt 0 ]; then
          warn "$MERGE_DRIFT file(s) were reported as merged but do NOT match the scaffold."
          warn "Re-run the installer after resolving; otherwise this drift is baked into .conf/checksums.json."
        fi

        rm -rf "$COMPARE_TMPDIR"
      fi
    else
      warn "python3 not available for smart merge — falling back to rsync --ignore-existing"
      if command -v rsync &>/dev/null; then
        rsync -a --ignore-existing "$SCAFFOLD_DIR/" "$PROJECT_PATH/"
      fi
    fi
  else
    warn "compare-install.sh not found — falling back to rsync --ignore-existing"
    if command -v rsync &>/dev/null; then
      rsync -a --ignore-existing "$SCAFFOLD_DIR/" "$PROJECT_PATH/"
    fi
  fi

  # ── 3b bis: aoi_apps/ ──────────────────────────────────────────────────
  # Nothing to do here. aoi_apps/ goes through the same three-way merge as
  # every other governed tree, above.
  #
  # It used to be wholesale replaced (rm -rf + cp -R) on the premise that
  # "native AOI apps always use latest". That premise contradicted the SDD
  # lifecycle, which lands user features inside aoi_apps and mirrors them into
  # scaffold/ under Invariant 7 — so a reinstall silently destroyed real work,
  # with no warning, no backup and no entry in .conf/conflicts/. The two
  # premises cannot both hold, and the destructive one was winning.
  #
  # The merge is strictly safer: a file the user owns is absent from the
  # scaffold, so it is never visited; an AOI file the user did not touch is
  # auto-updated; one that both sides changed becomes a reported conflict.
  # node_modules/ no longer needs rescuing because nothing is removed.

  # NOTE: .github/ and scripts/ used to be re-copied wholesale right here, to
  # undo the damage `specify init --force` had just done in Phase 2. That
  # blanket copy overwrote files the comparison had classified SKIP — 167 of
  # the 316 governed files, 53% of the tree — so for most of the workspace the
  # three-way merge was theatre: a conflict was detected, the new version was
  # written to .conf/conflicts/, the operator was told their file had been
  # preserved, and then it was overwritten two steps later.
  #
  # It is gone because its cause is gone: spec-kit no longer runs on reinstall,
  # so there is nothing left to repair. The merge above is now the single
  # authority over every governed file.

  ok "Reinstall merge complete"

else
  # ── Fresh install ─────────────────────────────────────────────────────────
  #
  # "Fresh" means AOI has never been installed here — NOT that the directory is
  # empty. Adding AOI to a project that already exists is the primary use case,
  # and a plain `rsync -a` overwrote every file the scaffold happens to carry.
  # Reproduced: a project's own package.json went from "el-proyecto-del-owner"
  # to "aoi-workspace", taking its name, version, dependencies and scripts with
  # it, and its CLAUDE.md was replaced too.
  #
  # `--ignore-existing` inverts the default to the safe one: AOI adds what is
  # missing and never replaces what is already there. On a genuinely empty
  # directory it behaves identically, so nothing is lost for the simple case.
  FRESH_KEPT=""
  if command -v rsync &>/dev/null; then
    FRESH_KEPT="$(rsync -a --ignore-existing --out-format='%n' "$SCAFFOLD_DIR/" "$PROJECT_PATH/" >/dev/null 2>&1; \
      rsync -an --existing --out-format='%n' "$SCAFFOLD_DIR/" "$PROJECT_PATH/" 2>/dev/null | grep -v '/$' || true)"
    ok "Scaffold merged (rsync, sin pisar lo existente)"
  else
    cd "$SCAFFOLD_DIR"
    while IFS= read -r file || [ -n "$file" ]; do
      target="$PROJECT_PATH/$file"
      if [ -e "$target" ]; then
        FRESH_KEPT="$FRESH_KEPT
${file#./}"
        continue
      fi
      mkdir -p "$(dirname "$target")"
      cp "$file" "$target"
    done <<EOF
$(find . -type f)
EOF
    cd "$PROJECT_PATH"
    ok "Scaffold merged (cp, sin pisar lo existente)"
  fi

  # AOI needs its own npm scripts to exist, and a project that already has a
  # package.json just had its copy protected above — so the scripts are merged
  # in rather than the file being replaced.
  if [ -f "$PROJECT_PATH/package.json" ] && [ -f "$SCAFFOLD_DIR/package.json" ]; then
    node "$SCRIPT_DIR/scripts/multi-harness/merge-package-scripts.mjs" \
      "$PROJECT_PATH/package.json" "$SCAFFOLD_DIR/package.json" \
      && ok "AOI scripts merged into the existing package.json" \
      || warn "No se pudieron fusionar los scripts de AOI en package.json — revisalo a mano"
  fi

  if [ -n "$FRESH_KEPT" ]; then
    warn "Estos archivos ya existían y NO se tocaron:"
    printf '%s\n' "$FRESH_KEPT" | while IFS= read -r kept; do
      [ -n "$kept" ] && printf '     %s\n' "$kept"
    done
    warn "Si querés la versión de AOI de alguno, copiala vos desde el scaffold."
  fi

  prune_unselected_harness_files "$PROJECT_PATH" "$SELECTED_HARNESS"
fi

# ── Rebuild the scaffold mirror inside the target ───────────────────────────
#
# Invariant 7 asks the mirror to be byte-identical to the governed files, and
# `validate-scaffold-parity` checks exactly that inside the installed
# workspace. So the mirror has to be built from what the merge ACTUALLY left on
# disk, not from what AOI wanted to install.
#
# It used to be built the other way: AOI's scaffold was copied over the mirror
# wholesale and only `scripts/` was re-synced back from the project. Every
# other governed path — .github/prompts, the dashboard, the constitution —
# therefore carried AOI's version in the mirror while the project carried the
# user's. That is precisely the state the merge produces whenever it preserves
# a conflict, so the reward for resolving a conflict correctly was a parity
# failure the operator had no way to read.
#
# Base layer first (non-governed scaffold content, which has no project
# counterpart to copy from), then every governed path from the project on top.
mkdir -p "$PROJECT_PATH/scaffold"
if command -v rsync &>/dev/null; then
  rsync -a "$SCAFFOLD_DIR/" "$PROJECT_PATH/scaffold/"
else
  cp -R "$SCAFFOLD_DIR/"* "$PROJECT_PATH/scaffold/" 2>/dev/null || true
fi
prune_unselected_harness_files "$PROJECT_PATH/scaffold" "$SELECTED_HARNESS"

# The governed list is published by the gate itself rather than duplicated
# here: a path added there and forgotten here would silently stop being
# mirrored, and the mismatch only ever surfaces in someone else's workspace.
GOVERNED_PATHS="$(node "$SCRIPT_DIR/scripts/scaffold/validate-scaffold-parity.mjs" --list-paths 2>/dev/null || true)"
if [ -z "$GOVERNED_PATHS" ]; then
  warn "No se pudo leer la lista de paths gobernados — el espejo queda con la versión de AOI"
  warn "y validate-scaffold-parity puede fallar en este workspace. Revisá node y el scaffold."
else
  while IFS= read -r gp || [ -n "$gp" ]; do
    [ -z "$gp" ] && continue
    src="$PROJECT_PATH/$gp"
    [ -e "$src" ] || continue
    dst="$PROJECT_PATH/scaffold/$gp"
    mkdir -p "$(dirname "$dst")"
    if [ -d "$src" ]; then
      if command -v rsync &>/dev/null; then
        rsync -a --delete "$src/" "$dst/"
      else
        rm -rf "$dst" && cp -R "$src" "$dst"
      fi
    else
      cp "$src" "$dst"
    fi
  done <<GOVERNED_EOF
$GOVERNED_PATHS
GOVERNED_EOF
fi
ok "Scaffold mirror rebuilt from the installed tree (scaffold/)"

# NOTE: pnpm-workspace.yaml and pnpm-lock.yaml used to be copied here with a
# bare `cp`, unconditionally, in both the fresh and the reinstall path.
#
# Both files already travel inside the scaffold, so both already go through the
# policy that protects the owner: `rsync --ignore-existing` on a fresh install,
# the three-way merge on a reinstall. The copy ran afterwards and overrode
# whichever of the two had just decided. Adding AOI to an existing pnpm
# monorepo therefore replaced its `pnpm-workspace.yaml` — every package in it —
# and its lockfile, with no warning, no backup and no conflict entry.
#
# It is gone rather than guarded: the two paths it duplicated are already
# correct, and a second writer to the same file is what made them wrong.

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
ok "Directories: .tasks/ .sandboxes/ .resources/ aoi_apps/agentic-ops-dashboard/"

if [ -f "$PROJECT_PATH/aoi_apps/agentic-ops-dashboard/package.json" ]; then
  INSTALL_DASH_DEPS=1
  if [ "$SKIP_DASHBOARD_DEPS" -eq 1 ]; then
    INSTALL_DASH_DEPS=0
  elif [ "$AUTO_YES" -eq 0 ] && [ -t 0 ]; then
    printf "${YELLOW}▸${NC} ¿Instalar dependencias del dashboard ahora (pnpm install)? [Y/n]: "
    read -r DASH_CHOICE
    if [[ "$DASH_CHOICE" =~ ^[nN] ]]; then
      INSTALL_DASH_DEPS=0
    fi
  fi

  DASHBOARD_INSTALL_DIR="$PROJECT_PATH/aoi_apps/agentic-ops-dashboard"

  if [ "$INSTALL_DASH_DEPS" -eq 1 ]; then
    ensure_dashboard_runtime
    info "Installing dashboard package dependencies..."
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
        if (cd "$DASHBOARD_INSTALL_DIR" && (pnpm approve-builds 2>/dev/null || true)) && run_dashboard_install 2>&1 | tee "$DASHBOARD_INSTALL_LOG"; then
          ok "Dashboard dependencies installed after approving build scripts"
        else
          warn "Dashboard dependency install failed after approve-builds retry"
          info "El dashboard es opcional. Puedes instalarlo manualmente: cd \"$DASHBOARD_INSTALL_DIR\" && pnpm install"
        fi
      else
        warn "Dashboard dependency install failed"
        info "El dashboard es opcional. Puedes instalarlo manualmente: cd \"$DASHBOARD_INSTALL_DIR\" && pnpm install"
      fi
    fi

    rm -f "$DASHBOARD_INSTALL_LOG"
  else
    ok "Dashboard dependencies install omitido (modo manual seleccionado)"
    info "Para instalar las dependencias del dashboard manualmente cuando lo desees:"
    info "  pnpm --dir \"$DASHBOARD_INSTALL_DIR\" install"
  fi
fi

# ── Materialise .vscode/settings.json ───────────────────────────────────────
#
# The file is machine-specific: the scaffold ships a `__LOCAL_BIN__`
# placeholder because the real path depends on $HOME, and the terminal keys
# depend on the platform. So it is materialised rather than copied.
#
# This was three grep-selected branches plus `sed -i ''`, and both halves were
# broken outside macOS. `-i ''` is the BSD spelling: GNU sed takes the suffix
# attached to the flag, reads the empty string as the SCRIPT and the real
# expression as a filename, exits non-zero, and `set -euo pipefail` takes the
# whole installer down with it. Meanwhile every branch wrote `.osx` keys, which
# VS Code ignores anywhere else — so the branch that did not abort configured
# nothing. One materialiser in python3, which this block already depended on,
# replaces both: no sed dialect to get wrong, and one place where the platform
# is decided.
VSCODE_SETTINGS="$PROJECT_PATH/.vscode/settings.json"
LOCAL_BIN="$HOME/.local/bin"
HOMEBREW_PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$LOCAL_BIN:/usr/bin:/bin:/usr/sbin:/sbin"

case "$(uname -s 2>/dev/null || true)" in
  Darwin) VSCODE_OS_KEY="osx"; VSCODE_SHELL="/bin/zsh" ;;
  Linux)  VSCODE_OS_KEY="linux"; VSCODE_SHELL="$(command -v bash || echo /bin/bash)" ;;
  *)      VSCODE_OS_KEY="windows"; VSCODE_SHELL="" ;;
esac

mkdir -p "$PROJECT_PATH/.vscode"
if python3 - "$VSCODE_SETTINGS" "$LOCAL_BIN" "$HOMEBREW_PATH" "$VSCODE_OS_KEY" "$VSCODE_SHELL" <<'PYEOF'
import json, os, sys

settings_path, local_bin, homebrew_path, os_key, shell = sys.argv[1:6]

settings = {}
if os.path.exists(settings_path):
    try:
        with open(settings_path) as f:
            settings = json.load(f)
    except (ValueError, OSError):
        # A settings.json we cannot parse belongs to the owner and is not ours
        # to rewrite. Say so and change nothing.
        sys.exit(3)
    if not isinstance(settings, dict):
        sys.exit(3)

# The placeholder is substituted wherever it survived the copy, so a scaffold
# file and a hand-written one converge on the same result.
def substitute(value):
    if isinstance(value, str):
        return value.replace("__LOCAL_BIN__", local_bin)
    if isinstance(value, dict):
        return {k: substitute(v) for k, v in value.items()}
    if isinstance(value, list):
        return [substitute(v) for v in value]
    return value

settings = substitute(settings)

env_key = "terminal.integrated.env." + os_key
profile_key = "terminal.integrated.automationProfile." + os_key

# Only fill what is missing: a PATH the owner already configured is theirs.
env = settings.setdefault(env_key, {})
if isinstance(env, dict) and not env.get("PATH"):
    env["PATH"] = homebrew_path

if shell and profile_key not in settings:
    settings[profile_key] = {"path": shell, "args": ["-l"]}

with open(settings_path, "w") as f:
    json.dump(settings, f, indent=4)
    f.write("\n")
PYEOF
then
  ok "PATH + automationProfile configurados en .vscode/settings.json ($VSCODE_OS_KEY)"
else
  warn ".vscode/settings.json no es JSON válido — se dejó intacto, configuralo a mano"
fi

VSCODE_MCP="$PROJECT_PATH/.vscode/mcp.json"
CBM_BIN="$(get_codebase_memory_path || true)"

# Invariant 1 in one line of config: every MCP server is registered BEHIND the
# compressor instead of directly.
#
# Measured on this workspace, `tools/list` before and after:
#   icm                  31 tools  3.538 -> 638 tokens
#   codebase-memory-mcp  14 tools  2.888 -> 460 tokens
#   total                          6.426 -> 1.098 tokens  (-83%)
#
# Those tokens are paid in the system prompt of every request that carries the
# MCP surface, so the saving repeats all session long — it is not a per-cycle
# figure. `high` rather than `max`: it exposes the same two frontend tools and
# keeps a wider margin of behavioural safety for a few hundred tokens more.
#
# The compressed surface is not a black box. `server_get_tool_schema` carries
# every backend signature inline — `<tool>icm_memory_recall(query, topic,
# limit, keyword, project)</tool>` — so the prompts that name those calls still
# have the signature in view; only the invocation is routed through
# `server_invoke_tool`.
MCP_COMPRESSION="${AOI_MCP_COMPRESSION:-high}"
if command -v mcp-compressor &>/dev/null; then
  ICM_CMD='"mcp-compressor"'
  ICM_ARGS="\"-c\", \"$MCP_COMPRESSION\", \"--\", \"bash\", \"\${workspaceFolder}/.github/scripts/icm-serve.sh\""
  CBM_CMD='"mcp-compressor"'
  CBM_ARGS="\"-c\", \"$MCP_COMPRESSION\", \"--\", \"$CBM_BIN\""
else
  ICM_CMD='"bash"'
  ICM_ARGS="\"\${workspaceFolder}/.github/scripts/icm-serve.sh\""
  CBM_CMD="\"$CBM_BIN\""
  CBM_ARGS=""
fi

# Merged by key, not regenerated. The file used to be rewritten wholesale on
# every run, so an MCP server the owner had registered here — or one another
# tool added — disappeared without a word. AOI owns exactly its own two
# entries under "servers"; everything else in the object belongs to whoever
# put it there.
if python3 - "$VSCODE_MCP" "$ICM_CMD" "$ICM_ARGS" "$CBM_CMD" "$CBM_ARGS" "${CBM_BIN:-}" <<'PYEOF'
import json, os, sys

mcp_path, icm_cmd, icm_args, cbm_cmd, cbm_args, cbm_bin = sys.argv[1:7]

def unquote_list(raw):
    """The shell builds these as a JSON array body, e.g. '"-c", "high"'."""
    raw = raw.strip()
    if not raw:
        return []
    return json.loads("[" + raw + "]")

config = {}
if os.path.exists(mcp_path):
    try:
        with open(mcp_path) as f:
            config = json.load(f)
    except (ValueError, OSError):
        sys.exit(3)
    if not isinstance(config, dict):
        sys.exit(3)

servers = config.setdefault("servers", {})
if not isinstance(servers, dict):
    sys.exit(3)

servers["icm"] = {"type": "stdio", "command": json.loads(icm_cmd), "args": unquote_list(icm_args)}
if cbm_bin:
    servers["codebase-memory-mcp"] = {
        "type": "stdio",
        "command": json.loads(cbm_cmd),
        "args": unquote_list(cbm_args),
    }

with open(mcp_path, "w") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PYEOF
then
  if [[ -n "$CBM_BIN" ]]; then
    ok "Workspace MCP configured in .vscode/mcp.json (ICM + codebase-memory-mcp, compression=$MCP_COMPRESSION)"
  else
    ok "Workspace MCP configured in .vscode/mcp.json (ICM only, compression=$MCP_COMPRESSION)"
  fi
else
  warn ".vscode/mcp.json no es JSON válido — se dejó intacto, configuralo a mano"
fi

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
if [[ -n "$(get_codebase_memory_path || true)" ]]; then
  ok "codebase-memory-mcp → Workspace MCP registered (.vscode/mcp.json)"
fi
icm init --mode hook 2>/dev/null && ok "ICM → Hooks installed (auto-extraction)" || warn "ICM hooks skipped"
icm init --mode skill 2>/dev/null && ok "ICM → Skills installed" || warn "ICM skills skipped"
icm init --mode cli 2>/dev/null && ok "ICM → CLI instructions" || warn "ICM CLI instructions skipped"
# Remove tools we don't use (icm init --mode cli installs for all tools indiscriminately)
rm -f "$PROJECT_PATH/.windsurfrules" 2>/dev/null && warn "Removed .windsurfrules (Windsurf not in use)" || true
# Ensure icm-serve.sh is executable (needed for VS Code that inherits limited PATH)
chmod +x "$PROJECT_PATH/.github/scripts/icm-serve.sh" 2>/dev/null || true
chmod +x "$PROJECT_PATH/.github/scripts/icm-hook.sh" 2>/dev/null || true

# Hook wiring. The declarations under .github/hooks/ used to sit there loaded
# by nobody while a skill in the x6 band told agents the RTK rule enforced
# itself. Translating them into the harness's own config is what makes that
# sentence true.
if [ -f "$SCRIPT_DIR/scripts/multi-harness/install-hooks.mjs" ]; then
  node "$SCRIPT_DIR/scripts/multi-harness/install-hooks.mjs" 2>/dev/null \
    && ok "Hooks wired → .claude/settings.json" \
    || warn "Hook wiring skipped — declarations in .github/hooks/ will not fire"
fi

# Multi-Harness Rules Compilation
if [ -f "$SCRIPT_DIR/scripts/multi-harness/compile-rules.mjs" ]; then
  node "$SCRIPT_DIR/scripts/multi-harness/compile-rules.mjs" --harness "$SELECTED_HARNESS" --workspace "$PROJECT_NAME" --prune 2>/dev/null || true
  prune_unselected_harness_files "$PROJECT_PATH" "$SELECTED_HARNESS"
  ok "Multi-harness rules compiled ($SELECTED_HARNESS)"
fi

# ── Phase 5: Persist Initial Context in ICM ──────────────────────────────
header "Phase 5: ICM Bootstrap"

require_icm

# Facts: deterministic metadata
icm facts set "$PROJECT_NAME" "harness.selected" "$SELECTED_HARNESS" 2>/dev/null || true
icm facts set "$PROJECT_NAME" "icm.protocol" "v4" 2>/dev/null || true
ok "Facts: initial configuration registered ($SELECTED_HARNESS, v4)"

# Memory: store initialization context (project-isolated)
icm store -t "$PROJECT_NAME-context" \
  -c "$PROJECT_NAME initialized with AOI (Agentic Operational Infrastructure) v4. Harness: $SELECTED_HARNESS. Stack: Hub-and-Spoke orchestration, SDD lifecycle (spec-kit), ICM persistence (5 methods: memories, memoirs, facts, feedback, transcripts), RTK token optimization. Agents in .github/agents/. Task artifacts in .tasks/{feature}/TASK-YYYY-NNN/." \
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

icm memoir link -m "$PROJECT_NAME-architecture" \
  --from "hub-and-spoke" --to "sdd-lifecycle" -r depends_on 2>/dev/null || true

ok "Memoir: architecture graph bootstrapped"

# Fast Briefing: deterministic bootstrap
mkdir -p "$PROJECT_PATH/.specify/memory/briefings"
cat > "$PROJECT_PATH/.specify/memory/briefings/active-briefing.md" <<EOF
# $PROJECT_NAME — Fast Operational Briefing

- **Workspace**: $PROJECT_NAME
- **Architecture**: AOI v4.0.0 (Hub-and-Spoke, SDD Lifecycle, Spatiotemporal Fibers)
- **Harness**: $SELECTED_HARNESS
- **Memory Protocol**: ICM v0.10+ Protocol v4 (5 Methods: Memories, Memoirs, Facts, Feedback, Transcripts)
- **Health**: Governed via \`pnpm aoi:doctor\`
EOF
ok "Briefing: deterministic active-briefing.md initialized"

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

# ── Phase 7: Persist Configuration Snapshot (.conf/) ──────────────────────
header "Phase 7: Configuration Snapshot"

CONF_SNAPSHOT_SCRIPT="$SCRIPT_DIR/scripts/conf/snapshot-conf.sh"

if [ -f "$CONF_SNAPSHOT_SCRIPT" ]; then
  CONF_ACTION="install"
  if [ "$IS_REINSTALL" -eq 1 ]; then
    CONF_ACTION="reinstall"
  fi

  # Fatal, not a warning. `.conf/` is the ONLY record of what AOI installed,
  # and the whole three-way merge is subtraction against it. Without it the
  # next run reads no manifest, concludes this is a first install, and lets
  # `specify init --force` flatten .github/ and .specify/ — the exact
  # destruction the reinstall path exists to prevent. An installation that
  # cannot write its own baseline is not a finished installation, and saying
  # so now costs one message instead of someone's work later.
  if bash "$CONF_SNAPSHOT_SCRIPT" "$SCAFFOLD_DIR" "$PROJECT_PATH" "$CONF_ACTION" "0.1.x"; then
    ok "Configuration snapshot persisted to .conf/"
  else
    err "No se pudo escribir .conf/ — la instalación queda sin línea base."
    err "El próximo reinstall no podría distinguir una actualización de AOI de una edición tuya,"
    err "y correría 'specify init --force' sobre .github/ y .specify/. Arreglá el acceso a"
    err "  $PROJECT_PATH/.conf"
    err "y volvé a correr el instalador."
    exit 1
  fi

  # On reinstall, update manifest.updated_at and append detailed stats to history
  if [ "$IS_REINSTALL" -eq 1 ] && [ -f "$PROJECT_PATH/.conf/manifest.json" ]; then
    NOW_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    if command -v python3 &>/dev/null; then
      python3 -c "
import json
with open('$PROJECT_PATH/.conf/manifest.json') as f:
    m = json.load(f)
m['updated_at'] = '$NOW_TS'
with open('$PROJECT_PATH/.conf/manifest.json', 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
" 2>/dev/null && ok "Manifest updated_at refreshed"
    fi
    # Append detailed reinstall stats
    echo "{\"action\":\"reinstall\",\"at\":\"$NOW_TS\",\"aoi_version\":\"0.1.x\",\"files_updated\":$REINSTALL_STATS_UPDATED,\"files_kept\":$REINSTALL_STATS_SKIPPED,\"conflicts\":$REINSTALL_STATS_CONFLICTS,\"new_files\":$REINSTALL_STATS_NEW,\"orphans_removed\":$REINSTALL_STATS_ORPHANS,\"orphans_kept\":$REINSTALL_STATS_ORPHANS_KEPT}" \
      >> "$PROJECT_PATH/.conf/history.jsonl"
    ok "Reinstall stats recorded in .conf/history.jsonl"
  fi
else
  err "snapshot-conf.sh no está junto a setup.sh — .conf/ no se puede generar."
  err "Sin esa línea base el próximo reinstall es destructivo. Instalación abortada."
  exit 1
fi

# ── Done ─────────────────────────────────────────────────────────────────
report_harness_kept

header "Installation Complete"

echo "  Project: $PROJECT_PATH"
echo ""
echo "  Tools installed:"
command -v rtk     &>/dev/null && echo "    ✓ RTK   $(rtk --version 2>/dev/null || echo '')" || echo "    ✗ RTK"
command -v icm     &>/dev/null && echo "    ✓ ICM   $(icm --version 2>/dev/null || echo '')" || echo "    ✗ ICM"
CBM_BIN="$(get_codebase_memory_path || true)"
if [[ -n "$CBM_BIN" ]]; then
  echo "    ✓ Codebase Memory MCP   $($CBM_BIN --version 2>/dev/null || echo '')"
else
  echo "    ○ Codebase Memory MCP   optional / not installed"
fi
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
echo "    6. Verify workspace health: pnpm aoi:doctor"
echo ""
