#!/usr/bin/env bash
# scripts/aoi-headroom-wrap.sh — Mandatory wrapper for GitHub Copilot CLI invocations.
#
# Why this exists: in AOI v0.1.x, Headroom is MANDATORY. Copilot CLI calls that
# bypass `headroom wrap` defeat the mandatory policy. Agent SDD prompts invoke
# this wrapper instead of `copilot` directly, so any LLM-bound CLI call from
# this workspace leaves through `headroom wrap copilot --subscription`.
#
# Behavior:
#   - Refuses to run unless `headroom` resolves on PATH (mandatory → AOI).
#   - Re-execs `headroom wrap copilot --subscription` with the original args,
#     preserving argv and exit code.
#   - If invoked outside a Copilot CLI context (e.g. `bash this-script foo`)
#     it still wraps because the OWNER contract says all Copilot invocations
#     MUST go through Headroom; you can override per-call with --aoi-bypass
#     which logs and aborts loudly.
#
# Invocations (examples):
#   bash scripts/aoi-headroom-wrap.sh --model gpt-4o "" "Summarize this file"
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/aoi-headroom-wrap.ps1 --model gpt-4o

set -euo pipefail

bypass=0
passthrough_args=()

for arg in "$@"; do
  case "$arg" in
    --aoi-bypass)
      bypass=1
      ;;
    *)
      passthrough_args+=("$arg")
      ;;
  esac
done

if [ "$bypass" -eq 1 ]; then
  printf "\033[1;33m[aoi-headroom-wrap]\033[0m \033[1;31mBYPASS requested\033[0m — Headroom mandatory policy violated.\n" >&2
  printf "    File an explicit override ticket or remove --aoi-bypass from the call site.\n" >&2
  exit 78
fi

if ! command -v headroom >/dev/null 2>&1; then
  printf "\033[1;31m[FAIL]\033[0m \033[1mheadroom\033[0m not found in PATH. Headroom is MANDATORY for AOI.\n" >&2
  printf "    Re-run: bash scripts/install-headroom.sh --yes\n" >&2
  printf "    Aborted by AOI bootstrap policy.\n" >&2
  exit 127
fi

if [ "${#passthrough_args[@]}" -eq 0 ]; then
  printf "\033[1;33m[USAGE]\033[0m aoi-headroom-wrap <copilot args>\n" >&2
  printf "    Example: bash scripts/aoi-headroom-wrap.sh --model gpt-4o \"\" \"Summarize file.\"\n" >&2
  exit 64
fi

printf "\033[1;34m[aoi-headroom-wrap]\033[0m routing through \033[1mheadroom wrap copilot\033[0m\n" >&2
exec headroom wrap copilot --subscription "${passthrough_args[@]}"
