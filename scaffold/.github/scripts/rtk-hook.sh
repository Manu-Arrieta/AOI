#!/usr/bin/env bash
# rtk-hook.sh — RTK PreToolUse hook wrapper
# Resolves RTK binary path for GUI apps (VS Code) that inherit
# a limited PATH from launchd and may not see Homebrew binaries.
#
# Called by: .github/hooks/rtk-rewrite.json (Copilot, sin argumento) y por
# .claude/settings.json con `claude` (lo traduce install-hooks.mjs).
#
# El dialecto es un argumento porque cada harness espera otra respuesta: con la
# misma entrada, `rtk hook copilot` devuelve `permissionDecision: "ask"` y en
# Claude Code eso abría un pedido de permiso en CADA comando reescrito fuera
# del modo bypass; `rtk hook claude` devuelve el mismo `updatedInput` sin
# decidir el permiso.

set -euo pipefail

DIALECT="${1:-copilot}"
case "$DIALECT" in
  copilot|claude) ;;
  *)
    # exit 1 y no 2: en Claude Code un exit 2 en PreToolUse BLOQUEA la tool.
    echo "[rtk-hook] dialecto desconocido: $DIALECT (copilot|claude)" >&2
    exit 1
    ;;
esac

RTK_BIN=""

for candidate in \
  "$(command -v rtk 2>/dev/null)" \
  "/opt/homebrew/bin/rtk" \
  "/usr/local/bin/rtk" \
  "$HOME/.local/bin/rtk" \
  "$HOME/.cargo/bin/rtk"
do
  if [ -x "$candidate" ]; then
    RTK_BIN="$candidate"
    break
  fi
done

if [ -z "$RTK_BIN" ]; then
  if [ "$DIALECT" = claude ]; then
    # Claude Code lee un stdout `{...}` como la RESPUESTA del hook: devolverle
    # su propia entrada no es "dejar pasar". Sin salida, la tool corre igual.
    cat >/dev/null
  else
    # RTK not found — pass through stdin unmodified so the tool still runs
    cat
  fi
  exit 0
fi

exec "$RTK_BIN" hook "$DIALECT"
