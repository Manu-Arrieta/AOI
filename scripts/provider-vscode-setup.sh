#!/usr/bin/env bash
# scripts/provider-vscode-setup.sh — DETECTA los proveedores configurados. NO ESCRIBE.
#
# Hasta el 2026-09-28 este script copiaba `scaffold/.vscode/ChatLanguageModel.example.json`
# al User dir de VS Code. Se retiró por dos defectos medidos:
#
#   1. Las referencias de secreto —`${input:chat.lm.secret.<hash>}`— son de la máquina
#      donde se generó el template: el hash lo crea VS Code al agregar el proveedor.
#      Medido contra el perfil real, 4 de 6 no resolvían. Copiarlo producía una
#      configuración que parece correcta y falla al autenticar.
#   2. El flujo hacía `cp` sobre el destino, así que aceptar su confirmación destruía
#      la configuración que sí funcionaba.
#
# Un script no puede fabricar ese hash, así que la decisión correcta no es "copiar
# mejor" sino "no copiar". Este script reporta lo que hay; si no hay nada, indica cómo
# agregarlo desde la UI de VS Code, que crea la entrada Y el secreto.
#
# La lógica vive en `scripts/multi-harness/provider-config.mjs` — con tests, y compartida
# con el gate `aoi:providers`. Duplicarla acá sería la tercera copia de una decisión.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE="$SCRIPT_DIR/multi-harness/provider-config.mjs"

if [[ ! -f "$MODULE" ]]; then
  echo "No se encontró $MODULE" >&2
  echo "Se corre junto al resto de scripts/multi-harness/. Si falta, la instalación está incompleta." >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node no está disponible: no se pueden detectar los proveedores." >&2
  exit 2
fi

# Siempre exit 0 cuando detecta o cuando falta la configuración: no configuración es un
# estado válido durante el setup, no un fallo. Sólo 2 es error de instalación, arriba.
exec node "$MODULE" "$@"
