#!/usr/bin/env bash
# snapshot-conf.sh — Create configuration snapshot in .conf/
# Copies scaffold files into .conf/snapshots/ organized by category,
# generates checksums.json and manifest.json, and appends to history.jsonl.
#
# Usage:
#   bash scripts/conf/snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>] [<profile>]
#
# <action>: "install" | "reinstall" | "constitution_update"

set -euo pipefail

SCAFFOLD_DIR="${1:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
PROJECT_DIR="${2:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
ACTION="${3:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
AOI_VERSION="${4:-0.1.x}"
INSTALLATION_PROFILE="${5:-dashboard}"

case "$INSTALLATION_PROFILE" in
  core|advanced|dashboard) ;;
  *) echo "Error: invalid installation profile: $INSTALLATION_PROFILE" >&2; exit 2 ;;
esac

SCAFFOLD_DIR="${SCAFFOLD_DIR%/}"
PROJECT_DIR="${PROJECT_DIR%/}"
CONF_DIR="$PROJECT_DIR/.conf"
SNAPSHOTS_DIR="$CONF_DIR/snapshots"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors (match setup.sh) ─────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { printf "${GREEN}✓${NC} %s\n" "$1"; }
info() { printf "\033[0;34m▸${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PROJECT_NAME="$(basename "$PROJECT_DIR")"

# ── Create snapshot directories ─────────────────────────────────────────────
info "Creating .conf/ snapshot structure..."
mkdir -p "$SNAPSHOTS_DIR/agents"
mkdir -p "$SNAPSHOTS_DIR/skills"
mkdir -p "$SNAPSHOTS_DIR/prompts"
mkdir -p "$SNAPSHOTS_DIR/constitutions"
mkdir -p "$SNAPSHOTS_DIR/configs"
mkdir -p "$SNAPSHOTS_DIR/scripts"
mkdir -p "$SNAPSHOTS_DIR/aoi_apps"
mkdir -p "$CONF_DIR/conflicts"

# ── Copy scaffold files to snapshots (organized by category) ────────────────
info "Snapshotting scaffold files..."

# Agents (Copilot)
if [ -d "$SCAFFOLD_DIR/.github/agents" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/.github/agents/" "$SNAPSHOTS_DIR/agents/copilot/" 2>/dev/null || \
    cp -R "$SCAFFOLD_DIR/.github/agents/." "$SNAPSHOTS_DIR/agents/copilot/"
fi

# Prompts
if [ -d "$SCAFFOLD_DIR/.github/prompts" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/.github/prompts/" "$SNAPSHOTS_DIR/prompts/" 2>/dev/null || \
    cp -R "$SCAFFOLD_DIR/.github/prompts/." "$SNAPSHOTS_DIR/prompts/"
fi

# Constitutions
for const_file in \
  "$SCAFFOLD_DIR/.specify/memory/constitution.md" \
  "$SCAFFOLD_DIR/.resources/constitution.md"; do
  if [ -f "$const_file" ]; then
    cp "$const_file" "$SNAPSHOTS_DIR/constitutions/$(basename "$(dirname "$const_file")")-constitution.md"
  fi
done

# .vscode configs
if [ -d "$SCAFFOLD_DIR/.vscode" ]; then
  mkdir -p "$SNAPSHOTS_DIR/configs/.vscode"
  for vsc_file in "$SCAFFOLD_DIR/.vscode/"*; do
    [ -f "$vsc_file" ] && cp "$vsc_file" "$SNAPSHOTS_DIR/configs/.vscode/"
  done
fi

# Scripts
if [ -d "$SCAFFOLD_DIR/scripts" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/scripts/" "$SNAPSHOTS_DIR/scripts/" 2>/dev/null || \
    cp -R "$SCAFFOLD_DIR/scripts/." "$SNAPSHOTS_DIR/scripts/"
fi

# aoi_apps only belongs to the explicit Dashboard profile. A profile switch
# never deletes an owner-owned existing app; it merely stops snapshotting and
# governing it as AOI material.
if [ "$INSTALLATION_PROFILE" = "dashboard" ] && [ -d "$SCAFFOLD_DIR/aoi_apps" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/aoi_apps/" "$SNAPSHOTS_DIR/aoi_apps/" 2>/dev/null || {
    rm -rf "$SNAPSHOTS_DIR/aoi_apps"
    cp -R "$SCAFFOLD_DIR/aoi_apps" "$SNAPSHOTS_DIR/"
  }
fi

ok "Snapshots created in .conf/snapshots/"

# ── Generate checksums ──────────────────────────────────────────────────────
info "Generating checksums..."
CHECKSUM_EXCLUDE=""
if [ "$INSTALLATION_PROFILE" != "dashboard" ]; then
  CHECKSUM_EXCLUDE="aoi_apps"
fi
bash "$SCRIPT_DIR/generate-checksums.sh" "$SCAFFOLD_DIR" "$SCAFFOLD_DIR" "$CHECKSUM_EXCLUDE" > "$CONF_DIR/checksums.json"

# ── Re-baseline the files the installer materialises ────────────────────────
#
# checksums.json answers one question for the next reinstall: "what did AOI put
# here?" The comparator subtracts that from what is on disk and calls the
# remainder the owner's edit.
#
# A handful of files never arrive as a copy. `.vscode/settings.json` ships a
# `__LOCAL_BIN__` placeholder that only $HOME can resolve; `.vscode/mcp.json`
# is generated around the absolute path of the codebase-memory binary. Hashing
# the scaffold for those recorded a version that was never installed, so the
# very first reinstall read the installer's own substitution as a user edit and
# classified the file a CONFLICT — permanently, since the mismatch is
# reproduced on every run. AOI's updates to those two files could therefore
# never be applied, and the operator was asked to resolve a conflict nobody
# had caused.
#
# The list is deliberately short and explicit. Re-baselining anything else from
# disk would be dangerous in the exact opposite direction: on a fresh install
# `--ignore-existing` PRESERVES a file the owner already had, and recording
# that file as AOI's baseline would make the next reinstall see no user edit
# and quietly overwrite it.
TEMPLATED_PATHS=".vscode/settings.json
.vscode/mcp.json"

# Files `compile-rules.mjs` WRITES, interpolating the workspace name.
#
# Hashing the scaffold for these recorded `workspace: AOI` — the product's own
# name — while the file on disk says `workspace: <project>`. The two can never
# match, so every reinstall read AOI's own output as an Owner edit: the seven
# were kept stale forever, so AOI's updates to them could never land, and any
# change to a template surfaced as a CONFLICT asking the Owner to merge a file
# they had never opened.
#
# Safe to re-baseline from disk, unlike a copied file, because compile-rules
# rewrites these unconditionally: by the time this runs, the content on disk IS
# AOI's. The marker check below is what keeps that reasoning honest — if the
# generator did not run (node absent, phase skipped) the file would still be the
# Owner's, and recording it as AOI's baseline would make the next reinstall
# overwrite their work in silence.
GENERATED_PATHS=".github/copilot-instructions.md
CLAUDE.md
AGENTS.md
.clinerules
.cursorrules
.cursor/rules/aoi-rules.mdc
.agents/rules/aoi-rules.md"

# Every file compile-rules writes announces itself with this header.
GENERATED_MARKER="<!-- AOI /"

if command -v python3 &>/dev/null; then
  python3 - "$CONF_DIR/checksums.json" "$PROJECT_DIR" "$TEMPLATED_PATHS" "$GENERATED_PATHS" "$GENERATED_MARKER" <<'PYEOF' && ok "Checksums written to .conf/checksums.json" \
    || warn "No se pudo re-basear los checksums de los archivos materializados"
import hashlib, json, os, sys

checksums_path, project_dir, templated, generated, marker = sys.argv[1:6]

with open(checksums_path) as f:
    data = json.load(f)

files = data.setdefault("files", {})


def rebaseline(rel):
    full = os.path.join(project_dir, rel)
    if not os.path.isfile(full):
        return False
    with open(full, "rb") as fh:
        files[rel] = "sha256:" + hashlib.sha256(fh.read()).hexdigest()
    return True


for rel in (p.strip() for p in templated.split("\n")):
    if rel and rel in files:
        rebaseline(rel)

unmarked = []
for rel in (p.strip() for p in generated.split("\n")):
    if not rel or rel not in files:
        continue
    full = os.path.join(project_dir, rel)
    if not os.path.isfile(full):
        continue
    with open(full, "r", encoding="utf-8", errors="replace") as fh:
        head = fh.read(len(marker) + 64)
    if marker not in head:
        unmarked.append(rel)
        continue
    rebaseline(rel)

if unmarked:
    print("Sin marca de AOI, no se re-basean: " + ", ".join(unmarked), file=sys.stderr)

with open(checksums_path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PYEOF
else
  warn "python3 ausente — los archivos materializados quedarán como conflicto falso en el próximo reinstall"
  ok "Checksums written to .conf/checksums.json"
fi

# ── Generate manifest ──────────────────────────────────────────────────────
info "Generating manifest..."

if [ "$INSTALLATION_PROFILE" = "dashboard" ]; then
  FILE_COUNT="$(find "$SCAFFOLD_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
else
  FILE_COUNT="$(find "$SCAFFOLD_DIR" -type f ! -path "$SCAFFOLD_DIR/aoi_apps/*" ! -name '.gitkeep' | wc -l | tr -d ' ')"
fi

# Detect tool versions
RTK_VER="$(rtk --version 2>/dev/null || echo 'null')"
ICM_VER="$(icm --version 2>/dev/null || echo 'null')"
SPECIFY_VER="$(specify version 2>/dev/null || echo 'null')"
HEADROOM_VER="$(headroom --version 2>/dev/null || echo 'null')"
CBM_BIN="$(command -v codebase-memory-mcp 2>/dev/null || true)"
CBM_VER="null"
if [ -n "$CBM_BIN" ]; then
  CBM_VER="$("$CBM_BIN" --version 2>/dev/null || echo 'null')"
fi

# Quote non-null values as a SAFE JSON string.
# Some CLIs (notably `specify version`) print a multi-line ASCII-art banner with
# ANSI escapes. Embedding that raw produced an invalid .conf/manifest.json, which
# silently broke every consumer that json.load()s the manifest.
quote_ver() {
  if [ "$1" = "null" ] || [ -z "$1" ]; then
    echo "null"
    return
  fi
  # ANSI stripped, control chars dropped, quotes escaped. Prefer the first line
  # that actually carries a version number over banner art.
  local stripped
  stripped="$(printf '%s' "$1" \
    | LC_ALL=C sed -e 's/\x1b\[[0-9;]*[A-Za-z]//g' \
    | LC_ALL=C tr -d '\000-\010\013-\037' \
    | grep -v '^[[:space:]]*$')"
  local picked
  picked="$(printf '%s\n' "$stripped" | grep -m1 -E '[0-9]+\.[0-9]+' || true)"
  [ -z "$picked" ] && picked="$(printf '%s\n' "$stripped" | head -1)"
  local clean
  clean="$(printf '%s' "$picked" \
    | LC_ALL=C sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
    | LC_ALL=C sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' \
    | cut -c1-120)"
  if [ -z "$clean" ]; then
    echo "null"
  else
    echo "\"$clean\""
  fi
}

INSTALLER_HOST="$(uname -s 2>/dev/null || echo 'unknown')"

cat > "$CONF_DIR/manifest.json" <<EOF
{
  "\$schema": "aoi-conf-manifest-v1",
  "aoi_version": "$AOI_VERSION",
  "installed_at": "$NOW",
  "updated_at": "$NOW",
  "installer": "setup.sh",
  "installer_host": "$INSTALLER_HOST",
  "project_name": "$PROJECT_NAME",
  "scaffold_file_count": $FILE_COUNT,
  "selected_harness": $(quote_ver "${SELECTED_HARNESS:-all}"),
  "installation_profile": "$INSTALLATION_PROFILE",
  "tools": {
    "rtk": $(quote_ver "$RTK_VER"),
    "icm": $(quote_ver "$ICM_VER"),
    "specify": $(quote_ver "$SPECIFY_VER"),
    "headroom": $(quote_ver "$HEADROOM_VER"),
    "codebase_memory_mcp": $(quote_ver "$CBM_VER")
  }
}
EOF
ok "Manifest written to .conf/manifest.json"

# ── Append to history ───────────────────────────────────────────────────────
echo "{\"action\":\"$ACTION\",\"at\":\"$NOW\",\"aoi_version\":\"$AOI_VERSION\",\"installation_profile\":\"$INSTALLATION_PROFILE\",\"files_count\":$FILE_COUNT}" >> "$CONF_DIR/history.jsonl"
ok "History appended to .conf/history.jsonl"
