# Plan de Smoke Externo de AOI

Este plan verifica AOI tanto como repositorio público como bootstrapper downstream.

## Alcance

- Baseline limpia del repositorio público.
- Comportamiento local del runtime de AOI.
- Comportamiento del bootstrap sobre otro proyecto.
- Modos de falla críticos alrededor de `icm`, `rtk` y los prerrequisitos del dashboard.

## Prerrequisitos Compartidos

- Git
- VS Code con GitHub Copilot
- `icm`
- Node `>=20.19.0`
- `corepack` o `pnpm >=11.3.0`

## Chequeo de Baseline del Repositorio

1. Cloná AOI en el tag `v0.1.0`.
2. Verificá que `.tasks/registry.md` tenga sólo tablas vacías.
3. Verificá que `.sandboxes/registry.md` no tenga filas de sandboxes activas.
4. Verificá que `.specify/memory/versions/active.json` tenga `workspaceStates` vacío.

Resultado esperado:

- El repositorio abre como una baseline inicial limpia, sin datos operativos históricos.

## Smoke en macOS/Linux

1. Ejecutá `corepack pnpm install` o `pnpm install` desde la raíz de AOI.
2. Ejecutá `pnpm dev:dashboard`.
3. Abrí el dashboard y confirmá que renderiza sin tareas heredadas ni errores de parseo.
4. Ejecutá `pnpm test:dashboard`.
5. Ejecutá `pnpm test:memory-sync`.

Resultado esperado:

- Las dependencias instalan sin reparación manual.
- El dashboard levanta contra registries vacíos.
- Las pruebas del dashboard y de memory-sync pasan.

## Smoke en Windows

1. Abrí PowerShell en la raíz de AOI.
2. Ejecutá `corepack pnpm install` o `pnpm install`.
3. Ejecutá `pnpm dev:dashboard`.
4. Abrí el dashboard y confirmá que renderiza sin tareas heredadas ni errores de parseo.
5. Ejecutá `pnpm test:dashboard`.
6. Ejecutá `pnpm test:memory-sync`.

Resultado esperado:

- Las dependencias instalan y el runtime del dashboard funciona igual que en macOS/Linux.
- La suite de validación también pasa en Windows.

## Smoke de Bootstrap Downstream

1. Creá un repositorio scratch nuevo con un `README.md` mínimo e inicializalo con Git.
2. En macOS/Linux corré `bash "/path/to/AOI/setup.sh" "/path/to/scratch-repo"`.
3. En Windows corré `powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\path\to\scratch-repo"`.
4. Abrí el proyecto bootstrappeado en VS Code.
5. Verificá que el proyecto ahora incluya superficies de AOI como `.github/agents/`, `.github/prompts/`, `.vscode/mcp.json`, `.specify/`, `.resources/`, el `package.json` del workspace y `apps/agentic-ops-dashboard/`.
6. Corré `/init` y después `/sdd-new` desde Copilot Chat.

Resultado esperado:

- El proyecto recibe el scaffold de AOI correctamente.
- Los prompts de Copilot, los agentes y el registro MCP de ICM están presentes.
- El primer workflow puede arrancar sin historia de tareas heredada.

## Chequeos de Modos de Falla

1. Probá el setup en una máquina donde `icm` no esté disponible.
2. Probá el setup con `rtk` no disponible o con una falla intencional en su instalación.
3. Probá el setup sin Node `>=20.19.0`.
4. Probá el setup sin `corepack` y sin `pnpm >=11.3.0`.

Resultado esperado:

- La ausencia de `icm` bloquea el setup.
- La ausencia o falla de `rtk` no bloquea el setup.
- La ausencia de prerrequisitos del dashboard bloquea el setup antes de instalar dependencias.

## Criterios de Salida

- El repositorio público de AOI está limpio al clonarlo.
- El runtime de AOI instala y corre en macOS/Linux y Windows.
- El bootstrap downstream produce un workspace gobernado y limpio.
- El manejo de fallas coincide con la política documentada para `icm`, `rtk` y los prerrequisitos del dashboard.