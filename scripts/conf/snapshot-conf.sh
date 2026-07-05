#!/usr/bin/env bash
# snapshot-conf.sh — Create configuration snapshot in .conf/
# Copies scaffold files into .conf/snapshots/ organized by category,
# generates checksums.json and manifest.json, and appends to history.jsonl.
#
# Usage:
#   bash scripts/conf/snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]
#
# <action>: "install" | "reinstall" | "constitution_update"

set -euo pipefail

SCAFFOLD_DIR="${1:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
PROJECT_DIR="${2:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
ACTION="${3:?Usage: snapshot-conf.sh <scaffold_dir> <project_dir> <action> [<aoi_version>]}"
AOI_VERSION="${4:-0.1.x}"

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

# Agents (Copilot + Antigravity)
if [ -d "$SCAFFOLD_DIR/.github/agents" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/.github/agents/" "$SNAPSHOTS_DIR/agents/copilot/" 2>/dev/null || \
    cp -R "$SCAFFOLD_DIR/.github/agents/." "$SNAPSHOTS_DIR/agents/copilot/"
fi
if [ -d "$SCAFFOLD_DIR/.agent/skills/agents" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/.agent/skills/agents/" "$SNAPSHOTS_DIR/agents/antigravity/" 2>/dev/null || \
    cp -R "$SCAFFOLD_DIR/.agent/skills/agents/." "$SNAPSHOTS_DIR/agents/antigravity/"
fi

# Skills (non-agent skills)
while IFS= read -r -d '' skill_dir; do
  skill_name="$(basename "$skill_dir")"
  if [ "$skill_name" != "agents" ]; then
    mkdir -p "$SNAPSHOTS_DIR/skills/$skill_name"
    cp -R "$skill_dir/." "$SNAPSHOTS_DIR/skills/$skill_name/"
  fi
done < <(find "$SCAFFOLD_DIR/.agent/skills" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

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

# Configs (root-level config files)
for cfg_file in GEMINI.md; do
  if [ -f "$SCAFFOLD_DIR/$cfg_file" ]; then
    cp "$SCAFFOLD_DIR/$cfg_file" "$SNAPSHOTS_DIR/configs/"
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

# aoi_apps (full copy)
if [ -d "$SCAFFOLD_DIR/aoi_apps" ]; then
  rsync -a --delete "$SCAFFOLD_DIR/aoi_apps/" "$SNAPSHOTS_DIR/aoi_apps/" 2>/dev/null || {
    rm -rf "$SNAPSHOTS_DIR/aoi_apps"
    cp -R "$SCAFFOLD_DIR/aoi_apps" "$SNAPSHOTS_DIR/"
  }
fi

ok "Snapshots created in .conf/snapshots/"

# ── Generate checksums ──────────────────────────────────────────────────────
info "Generating checksums..."
bash "$SCRIPT_DIR/generate-checksums.sh" "$SCAFFOLD_DIR" "$SCAFFOLD_DIR" > "$CONF_DIR/checksums.json"
ok "Checksums written to .conf/checksums.json"

# ── Generate manifest ──────────────────────────────────────────────────────
info "Generating manifest..."

FILE_COUNT="$(find "$SCAFFOLD_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"

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

# Quote non-null values
quote_ver() {
  if [ "$1" = "null" ]; then
    echo "null"
  else
    echo "\"$1\""
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
echo "{\"action\":\"$ACTION\",\"at\":\"$NOW\",\"aoi_version\":\"$AOI_VERSION\",\"files_count\":$FILE_COUNT}" >> "$CONF_DIR/history.jsonl"
ok "History appended to .conf/history.jsonl"
