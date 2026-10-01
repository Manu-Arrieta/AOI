# scripts/provider-vscode-setup.ps1 — DETECTA los proveedores configurados. NO ESCRIBE.
#
# Hasta el 2026-09-28 este script copiaba `scaffold/.vscode/ChatLanguageModel.example.json`
# al User dir de VS Code. Se retiró por dos defectos medidos:
#
#   1. Las referencias de secreto —`${input:chat.lm.secret.<hash>}`— son de la máquina
#      donde se generó el template: el hash lo crea VS Code al agregar el proveedor.
#      Medido contra el perfil real, 4 de 6 no resolvían. Copiarlo producía una
#      configuración que parece correcta y falla al autenticar.
#   2. El flujo hacía una copia sobre el destino, así que aceptar su confirmación
#      destruía la configuración que sí funcionaba.
#
# Un script no puede fabricar ese hash, así que la decisión correcta no es "copiar
# mejor" sino "no copiar".
#
# La lógica vive en `scripts/multi-harness/provider-config.mjs` — con tests, y compartida
# con el gate `aoi:providers`. Duplicarla acá sería la tercera copia de una decisión.

$ErrorActionPreference = 'Stop'

$module = Join-Path $PSScriptRoot 'multi-harness/provider-config.mjs'

if (-not (Test-Path $module)) {
    Write-Error "No se encontró $module — se corre junto al resto de scripts/multi-harness/."
    exit 2
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "node no está disponible: no se pueden detectar los proveedores."
    exit 2
}

# Siempre 0 cuando detecta o cuando falta la configuración: no configuración es un estado
# válido durante el setup, no un fallo. Sólo 2 es error de instalación, arriba.
& node $module @args
exit $LASTEXITCODE
