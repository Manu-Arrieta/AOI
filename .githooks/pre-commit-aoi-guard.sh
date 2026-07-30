#!/usr/bin/env bash
# .githooks/pre-commit-aoi-guard.sh — Block `headroom learn` overwriting AOI-managed files.
#
# Why this exists: `headroom learn --apply` rewrites CLAUDE.md / AGENTS.md /
# AGENTS.md (the AOI-managed instruction files at the repo root) without
# AOI awareness. Headroom is MANDATORY, but AOI must keep ownership of its own
# managed instruction surface, or the bootstrap contracts drift in non-recoverable
# ways.
#
# Behavior:
#   - Runs as pre-commit hook. Stage-must-clear before commit succeeds, so any
#     unapproved diff touching these files aborts the commit.
#   - Recognizes diffs by `git diff --cached --name-only`.
#   - Allows changes ONLY when the commit subject contains `[aoi-managed-ok]`
#     which the Owner appends manually after explicit visual review.
#
# Invocations (manual):
#   bash .githooks/pre-commit-aoi-guard.sh           # standalone check
#   bash .githooks/pre-commit-aoi-guard.sh --force   # bypass on purpose (logs)

set -euo pipefail

AOI_MANAGED_FILES=(
  "AGENTS.md"
  "CLAUDE.md"
)

force=0
GIT_DIR=""
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
fi
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
  esac
done

# Detect staged files (preferred for pre-commit) or modified files (for standalone).
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  staged_or_modified="$(git diff --cached --name-only 2>/dev/null; git ls-files --modified 2>/dev/null)" || staged_or_modified=""
else
  staged_or_modified=""
fi

touched_aoi=()
for f in "${AOI_MANAGED_FILES[@]}"; do
  if printf '%s\n' "$staged_or_modified" | grep -Fxq "$f"; then
    touched_aoi+=("$f")
  fi
done

if [ "${#touched_aoi[@]}" -eq 0 ]; then
  exit 0
fi

if [ "$force" -eq 1 ]; then
  printf "\033[1;33m[WARN]\033[0m Forced bypass — managed files touched: %s\n" "${touched_aoi[*]}" >&2
  printf "\033[1;33m        This will overwrite AOI-managed instruction surface.\033[0m\n" >&2
  exit 0
fi

# Honour the [aoi-managed-ok] marker when the Owner appends it to the commit
# subject. Detection strategy: read the staged commit message — if the marker
# is present in either the current invocation (pre-commit gets no argv for
# subject, hence we read COMMIT_EDITMSG + log) or the latest staged subject,
# the override applies.
override_marker_present=0
if [ -s "$GIT_DIR/COMMIT_EDITMSG" ]; then
  if grep -qF "[aoi-managed-ok]" "$GIT_DIR/COMMIT_EDITMSG" 2>/dev/null; then
    override_marker_present=1
  fi
fi
if [ "$override_marker_present" -eq 0 ] && command -v git >/dev/null 2>&1 && [ -d "$GIT_DIR" ]; then
  # Last-resort: check if there's a HEAD commit that was about to be added
  # (rare). Otherwise the known marker has to be in COMMIT_EDITMSG.
  if git log -1 --pretty=%s 2>/dev/null | grep -qF "[aoi-managed-ok]"; then
    override_marker_present=1
  fi
fi

if [ "$override_marker_present" -eq 1 ]; then
  printf "\033[1;34m[AOI]\033[0m Manager override accepted (marker present). Managed files touched: %s\n" "${touched_aoi[*]}" >&2
  exit 0
fi

printf "\033[1;31m[BLOCK]\033[0m  AOI-managed files changed without explicit owner override:\n" >&2
for f in "${touched_aoi[@]}"; do
  printf "          • %s\n" "$f" >&2
done
printf "\n" >&2
printf "If this diff comes from \033[1mheadroom learn --apply\033[0m or any non-Owner\n" >&2
printf "tool, revert it:  git checkout -- %s\n" >&2 "${touched_aoi[*]}" >&2
printf "\n" >&2
printf "If the Owner \033[1mreviewed and approved\033[0m the diff, append the marker\n" >&2
printf "\033[1;36m[aoi-managed-ok]\033[0m to the commit subject and retry:\n" >&2
printf "  git commit -m \"... [aoi-managed-ok]\"\n" >&2
printf "\n" >&2
printf "Bypass (discouraged): bash .githooks/pre-commit-aoi-guard.sh --force\n" >&2
exit 1
