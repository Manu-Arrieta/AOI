#!/usr/bin/env bash
# .githooks/pre-commit-aoi-guard.sh — Block `headroom learn` overwriting AOI-managed files.
#
# Why this exists: `headroom learn --apply` rewrites copilot-instructions.md
# (the AOI-managed instruction file inside .github/) without AOI awareness.
# Headroom is MANDATORY, but AOI must keep ownership of its own managed
# instruction surface, or the bootstrap contracts drift in non-recoverable ways.
#
# Behavior:
#   - Runs as the `commit-msg` hook, which receives the message file as $1.
#     The index is already final there, so `git diff --cached` still answers,
#     and a failing hook still aborts the commit.
#   - Recognizes diffs by `git diff --cached --name-only`.
#   - Allows changes ONLY when the commit subject contains `[aoi-managed-ok]`
#     which the Owner appends manually after explicit visual review.
#
# Why not pre-commit, where this used to live: git writes COMMIT_EDITMSG only
# AFTER pre-commit succeeds, so the hook read the PREVIOUS commit's message.
# The override the error text told the operator to use could therefore never
# work on the commit it was written for — and the `git log -1` fallback made it
# worse, honouring a marker left in the commit before, authorising a diff
# nobody had reviewed. Verified directly: in pre-commit the file holds the
# prior subject, and is empty on the first commit.
#
# Invocations (manual):
#   bash .githooks/pre-commit-aoi-guard.sh                 # standalone check
#   bash .githooks/pre-commit-aoi-guard.sh <msgfile>       # as commit-msg
#   bash .githooks/pre-commit-aoi-guard.sh --force         # bypass on purpose

set -euo pipefail

AOI_MANAGED_FILES=(
  ".github/copilot-instructions.md"
  "CLAUDE.md"
  "AGENTS.md"
  ".cursorrules"
  ".cursor/rules/aoi-rules.mdc"
  ".clinerules"
  ".agents/rules/aoi-rules.md"
)

force=0
GIT_DIR=""
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo .git)"
fi
# `commit-msg` passes the message file as the first positional argument.
MSG_FILE=""
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    -*) ;;
    *) [ -z "$MSG_FILE" ] && [ -f "$arg" ] && MSG_FILE="$arg" ;;
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

# Honour the [aoi-managed-ok] marker, read from the message being written and
# from nowhere else.
#
# The two fallbacks that used to be here are gone because both answered about a
# DIFFERENT commit: $GIT_DIR/COMMIT_EDITMSG is not written until after
# pre-commit, and `git log -1` reads the subject already committed. Either one
# could approve today's unreviewed diff on the strength of yesterday's marker,
# which is the opposite of what an override is for.
override_marker_present=0
if [ -n "$MSG_FILE" ] && grep -qF "[aoi-managed-ok]" "$MSG_FILE" 2>/dev/null; then
  override_marker_present=1
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
if [ -z "$MSG_FILE" ]; then
  printf "\n" >&2
  printf "\033[1;33mAtención:\033[0m esta corrida no recibió el mensaje del commit, así que el\n" >&2
  printf "marcador no se puede leer. El guard tiene que estar cableado como hook\n" >&2
  printf "\033[1mcommit-msg\033[0m — es el único que lo recibe. Reinstalá AOI o cableálo a mano:\n" >&2
  printf "  ln -sf ../../.githooks/pre-commit-aoi-guard.sh .git/hooks/commit-msg\n" >&2
fi
printf "\n" >&2
printf "Bypass (discouraged): bash .githooks/pre-commit-aoi-guard.sh --force\n" >&2
exit 1
