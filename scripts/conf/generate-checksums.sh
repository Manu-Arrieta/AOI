#!/usr/bin/env bash
# generate-checksums.sh — Generate SHA-256 checksums for all files in a directory
# Part of AOI .conf configuration persistence system.
#
# Usage:
#   bash scripts/conf/generate-checksums.sh <source_dir> [<base_prefix>]
#
# Output: JSON to stdout with the structure:
#   { "$schema": "aoi-conf-checksums-v1", "generated_at": "...", "files": { "relative/path": "sha256:...", ... } }
#
# <base_prefix> is stripped from paths in the output (defaults to <source_dir>).

set -euo pipefail

SOURCE_DIR="${1:?Usage: generate-checksums.sh <source_dir> [<base_prefix>]}"
BASE_PREFIX="${2:-$SOURCE_DIR}"

# Normalize trailing slashes
SOURCE_DIR="${SOURCE_DIR%/}"
BASE_PREFIX="${BASE_PREFIX%/}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: directory not found: $SOURCE_DIR" >&2
  exit 1
fi

GENERATED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Collect checksums
declare -a entries=()

while IFS= read -r -d '' file; do
  # Compute relative path from BASE_PREFIX
  rel_path="${file#"$BASE_PREFIX"/}"

  # Skip .gitkeep files and directories
  if [[ "$(basename "$file")" == ".gitkeep" ]]; then
    continue
  fi

  # Compute SHA-256
  if command -v shasum &>/dev/null; then
    hash="$(shasum -a 256 "$file" | cut -d' ' -f1)"
  elif command -v sha256sum &>/dev/null; then
    hash="$(sha256sum "$file" | cut -d' ' -f1)"
  else
    echo "Error: neither shasum nor sha256sum found" >&2
    exit 1
  fi

  entries+=("\"$rel_path\": \"sha256:$hash\"")
done < <(find "$SOURCE_DIR" -type f -print0 | sort -z)

# Build JSON output
echo "{"
echo "  \"\$schema\": \"aoi-conf-checksums-v1\","
echo "  \"generated_at\": \"$GENERATED_AT\","
echo "  \"files\": {"

last_idx=$(( ${#entries[@]} - 1 ))
for i in "${!entries[@]}"; do
  if [ "$i" -eq "$last_idx" ]; then
    echo "    ${entries[$i]}"
  else
    echo "    ${entries[$i]},"
  fi
done

echo "  }"
echo "}"
