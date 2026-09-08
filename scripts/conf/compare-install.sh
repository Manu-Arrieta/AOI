#!/usr/bin/env bash
# compare-install.sh — Smart comparison for AOI reinstallation
# Compares scaffold files against previously installed checksums and current project state.
#
# Usage:
#   bash scripts/conf/compare-install.sh <scaffold_dir> <checksums_json> <project_dir>
#
# Output: JSON to stdout with classification per file:
#   { "skip": [...], "auto_update": [...], "conflict": [...], "new": [...] }
#
# Categories:
#   skip        — scaffold unchanged AND/OR user modified → don't touch
#   auto_update — scaffold changed, user did NOT modify → safe to replace
#   conflict    — scaffold changed AND user modified → needs manual resolution
#   new         — file exists in scaffold but not in previous checksums → copy
#   orphan          — AOI shipped it before, no longer does, user never touched
#                     it → safe to remove
#   orphan_modified — same, but the user edited it → report, never remove
#
# aoi_apps/ is compared like every other governed tree. It used to be excluded
# here and wholesale replaced by setup.sh, which destroyed any feature an SDD
# cycle had implemented inside the dashboard. A file the user owns is never in
# the scaffold, so it is never visited by this loop and cannot be touched.

set -euo pipefail

SCAFFOLD_DIR="${1:?Usage: compare-install.sh <scaffold_dir> <checksums_json> <project_dir>}"
CHECKSUMS_JSON="${2:?Usage: compare-install.sh <scaffold_dir> <checksums_json> <project_dir>}"
PROJECT_DIR="${3:?Usage: compare-install.sh <scaffold_dir> <checksums_json> <project_dir>}"

SCAFFOLD_DIR="${SCAFFOLD_DIR%/}"
PROJECT_DIR="${PROJECT_DIR%/}"

if [ ! -d "$SCAFFOLD_DIR" ]; then
  echo "Error: scaffold directory not found: $SCAFFOLD_DIR" >&2
  exit 1
fi

if [ ! -f "$CHECKSUMS_JSON" ]; then
  echo "Error: checksums file not found: $CHECKSUMS_JSON" >&2
  exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "Error: project directory not found: $PROJECT_DIR" >&2
  exit 1
fi

# ── Hashing helper ──────────────────────────────────────────────────────────
compute_sha256() {
  local file="$1"
  if command -v shasum &>/dev/null; then
    shasum -a 256 "$file" | cut -d' ' -f1
  elif command -v sha256sum &>/dev/null; then
    sha256sum "$file" | cut -d' ' -f1
  else
    echo "Error: neither shasum nor sha256sum found" >&2
    exit 1
  fi
}

# ── Extract stored checksum from JSON (portable, no jq dependency) ──────────
# Uses python3 if available, falls back to grep+sed.
get_stored_checksum() {
  local rel_path="$1"
  if command -v python3 &>/dev/null && python3 -V >/dev/null 2>&1; then
    python3 -c "
import json, sys
with open('$CHECKSUMS_JSON') as f:
    data = json.load(f)
v = data.get('files', {}).get('$rel_path', '')
print(v)
" 2>/dev/null
  else
    # Fallback: grep the JSON (fragile but works for simple cases)
    grep "\"$rel_path\"" "$CHECKSUMS_JSON" 2>/dev/null \
      | sed -E 's/.*"sha256:([a-f0-9]+)".*/sha256:\1/' \
      || echo ""
  fi
}

# ── Classify each scaffold file ─────────────────────────────────────────────
declare -a skip_files=()
declare -a update_files=()
declare -a conflict_files=()
declare -a new_files=()

while IFS= read -r -d '' scaffold_file; do
  rel_path="${scaffold_file#"$SCAFFOLD_DIR"/}"

  # Skip .gitkeep files
  if [[ "$(basename "$scaffold_file")" == ".gitkeep" ]]; then
    continue
  fi

  scaffold_hash="sha256:$(compute_sha256 "$scaffold_file")"
  stored_hash="$(get_stored_checksum "$rel_path")"
  project_file="$PROJECT_DIR/$rel_path"

  if [ -z "$stored_hash" ]; then
    # File not in previous checksums → NEW
    new_files+=("$rel_path")
    continue
  fi

  if [ ! -f "$project_file" ]; then
    # File was in previous install but deleted by user — treat as new
    new_files+=("$rel_path")
    continue
  fi

  current_hash="sha256:$(compute_sha256 "$project_file")"

  if [[ "$scaffold_hash" == "$stored_hash" ]]; then
    # Scaffold unchanged → SKIP (regardless of user changes)
    skip_files+=("$rel_path")
  elif [[ "$current_hash" == "$stored_hash" ]]; then
    # Scaffold changed, user did NOT modify → AUTO-UPDATE
    update_files+=("$rel_path")
  else
    # Both changed → CONFLICT
    conflict_files+=("$rel_path")
  fi

done < <(find "$SCAFFOLD_DIR" -type f -print0 | sort -z)

# ── Second pass: orphans ────────────────────────────────────────────────────
# The loop above walks the SCAFFOLD, so it can never see a file AOI used to
# ship and no longer does. Those linger in installed workspaces forever, and a
# stale prompt or agent left behind is still invocable — it does not read as
# obsolete to anyone, human or model.
#
# Removal is only safe under three conditions, all required:
#   1. the file is recorded in the previous checksums (AOI shipped it),
#   2. the project's copy is byte-identical to what AOI shipped (untouched),
#   3. it does not live in a state directory the owner accumulates work in.
# Anything failing (2) is reported instead, never deleted.
declare -a orphan_files=()
declare -a orphan_modified_files=()

is_protected_path() {
  case "$1" in
    .tasks/*|.sandboxes/*|.resources/*|.conf/*) return 0 ;;
    *) return 1 ;;
  esac
}

list_stored_paths() {
  if command -v python3 &>/dev/null && python3 -V >/dev/null 2>&1; then
    python3 -c "
import json
with open('$CHECKSUMS_JSON') as f:
    data = json.load(f)
for key in data.get('files', {}):
    print(key)
" 2>/dev/null
  fi
}

while IFS= read -r rel_path || [ -n "$rel_path" ]; do
  [ -z "$rel_path" ] && continue
  [ -f "$SCAFFOLD_DIR/$rel_path" ] && continue
  [ ! -f "$PROJECT_DIR/$rel_path" ] && continue
  is_protected_path "$rel_path" && continue

  stored_hash="$(get_stored_checksum "$rel_path")"
  current_hash="sha256:$(compute_sha256 "$PROJECT_DIR/$rel_path")"
  if [ "$current_hash" = "$stored_hash" ]; then
    orphan_files+=("$rel_path")
  else
    orphan_modified_files+=("$rel_path")
  fi
done < <(list_stored_paths)

# ── Output JSON ─────────────────────────────────────────────────────────────
# Takes the array ELEMENTS as positional arguments, not an array name.
# Namerefs (`local -n`) require bash 4.3+, and macOS ships bash 3.2 — using them
# here made this script abort mid-JSON on every macOS reinstall.
json_array() {
  local len=$#
  if [ "$len" -eq 0 ]; then
    echo "[]"
    return
  fi
  echo "["
  local i=0
  local item
  for item in "$@"; do
    i=$((i + 1))
    if [ "$i" -eq "$len" ]; then
      echo "      \"$item\""
    else
      echo "      \"$item\","
    fi
  done
  echo "    ]"
}

echo "{"
printf '  "skip": '
json_array ${skip_files[@]+"${skip_files[@]}"}
echo ","
printf '  "auto_update": '
json_array ${update_files[@]+"${update_files[@]}"}
echo ","
printf '  "conflict": '
json_array ${conflict_files[@]+"${conflict_files[@]}"}
echo ","
printf '  "new": '
json_array ${new_files[@]+"${new_files[@]}"}
echo ","
printf '  "orphan": '
json_array ${orphan_files[@]+"${orphan_files[@]}"}
echo ","
printf '  "orphan_modified": '
json_array ${orphan_modified_files[@]+"${orphan_modified_files[@]}"}
echo ""
echo "}"
