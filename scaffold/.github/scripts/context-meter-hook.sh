#!/usr/bin/env bash
# context-meter-hook.sh — UserPromptSubmit: mide el contexto de la sesión y, al
# cruzar el umbral, aconseja en una línea seguir la próxima fase SDD en un
# contexto nuevo. La lógica está en scripts/sdd-lifecycle/context-meter.mjs.
#
# Called by: .github/hooks/context-meter.json (Copilot) y .claude/settings.json
# (lo traduce install-hooks.mjs). Corre en cada prompt, nunca por tool.
#
# Se ubica desde su propia ruta y no desde el cwd: los hooks con rutas
# relativas fallaron 42-43 veces con "No such file or directory" en cuanto la
# sesión hacía `cd` fuera de la raíz. Sin `set -e` a propósito: un medidor no
# puede hacer fallar el prompt que mide, así que todo error termina en exit 0.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)"
METER="$ROOT/scripts/sdd-lifecycle/context-meter.mjs"

if [ -z "$ROOT" ] || [ ! -f "$METER" ] || ! command -v node >/dev/null 2>&1; then
  cat >/dev/null 2>&1 || true
  exit 0
fi

node "$METER" --hook 2>/dev/null || true
exit 0
