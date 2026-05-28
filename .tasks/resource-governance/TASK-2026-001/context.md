# Context — TASK-2026-001

- Feature: `resource-governance`
- Title: `Govern internal resources folder`
- Status: `📦 Archivado`
- Created: `2026-05-26`
- Owner: `Supervisor`

## Owner Intent

Agregar a la infraestructura agéntica una carpeta de recursos internos con dos
subcarpetas iniciales, `userstories/` y `workflows/`, para alimentar de
información relevante a Spec Driven Development. El usuario podrá optar por
vincular recursos de `.resources/` solo cuando lo requiera explícitamente durante
la construcción de una tarea o trabajar directamente con el agente sin
consumirlos. `userstories/` funcionará como repositorio de historias reutilizables
y `workflows/` como repositorio de definiciones sobre cómo interactúan
componentes dentro de una misma historia o entre múltiples historias. La
estructura de esta carpeta deberá definirse en su propio archivo de
constitución y las operaciones de creación, movimiento y eliminación deberán
resolverse con workflows separados como `/new-resource-folder`,
`/move-resource-folder` y `/delete-resource-folder`, actualizando la
constitución de forma dinámica. ICM deberá reflejar la estructura y el estado
actual del proyecto.

## Initial State

- `.tasks/registry.md` existe y no tenía features ni TASKs registrados.
- `.specify/memory/constitution.md` es la fuente de verdad del proyecto.
- `.atl/skill-registry.md` registra workflows SDD y sandbox, pero no existe un
  comando para gobernar carpetas de recursos.
- `GEMINI.md` documenta `.tasks/` como almacén formal de artefactos y la
  constitución como recurso principal.

## Exploration Focus

- Definir dónde vive la nueva carpeta de recursos dentro de la infraestructura.
- Determinar cómo el usuario puede vincular recursos desde `.resources/` durante
  la construcción de una tarea, sin volver obligatoria la existencia o lectura
  de esa carpeta.
- Diseñar el contrato de los workflows `/new-resource-folder`,
  `/move-resource-folder` y `/delete-resource-folder` y sus efectos de
  sincronización sobre constitución, scaffold e ICM.
- Identificar impactos en documentación, prompts, skill registry y setup.

## Exploration Outcome

- La constitución raíz actual no admite otras rutas de constitución como fuente
  de verdad, por lo que el cambio requiere una enmienda explícita de gobierno.
- El patrón más cercano para este feature es `/sandbox-new`: workflow del
  supervisor que crea estructura, registra estado y persiste contexto en ICM.
- `.resources/` debe vivir como subsistema optativo y no convertirse en
  dependencia de `/sdd-new`.

## Owner Corrections

- Los recursos de `.resources/` solo se vinculan cuando el usuario lo pide
  explícitamente durante la construcción de una tarea.
- Las operaciones sobre carpetas de recursos deben separarse en workflows
  distintos para create, move y delete.
- `workflows/` describe interacción entre componentes de una misma historia de
  usuario o entre múltiples historias; no representa comandos del sistema.

## Approval

- Proposal approved by Owner on `2026-05-26`.
- Handoff completed to `@functional-analyst` for `requirement.md`.

## Planning Outcome

- `spec.md`, `design.md`, `tasks.md`, and `implementation-plan.md` were created
  during `/sdd-ff`.
- The plan keeps `.resources/` optional for task construction, introduces
  separate administrative workflows for folder lifecycle, and preserves dual-sync
  between root and `scaffold/`.
- The implementation scope was constrained to real repository surfaces: prompt
  files, Antigravity skills, registries, constitutions, docs, and root
  setup/teardown scripts.

## Implementation Start

- `/sdd-apply` started on `2026-05-26`.
- First implementation slice targets the managed `.resources/` structure and
  setup/teardown symmetry before prompt and workflow changes.

## Implementation Complete

- `.resources/` is now part of the managed infrastructure in both the live repo
  and `scaffold/`.
- Setup and teardown scripts manage `.resources/` symmetrically across shell and
  PowerShell surfaces.
- The root constitution explicitly allows the subordinate
  `.resources/constitution.md` contract.
- `/sdd-new`, `/sdd-ff`, `/sdd-apply`, and `/sdd-verify` now encode the optional
  and non-executable semantics of resource linkage.
- `/new-resource-folder`, `/move-resource-folder`, and
  `/delete-resource-folder` now exist in Copilot, Antigravity, and `scaffold/`
  mirrors with explicit ICM persistence requirements.
- Public and runtime documentation now describe the `.resources/` subsystem and
  its support workflows.
- TASK-2026-001 is ready for `/sdd-verify`.

## Archive Complete

- `/sdd-verify` concluded with PASS and produced `verify-report.md`.
- `functional-docs.md` and `archive-report.md` were created for long-term
  closure of the task.
- Task memories were consolidated in ICM and the archive transcript session was
  recorded.
- `aoi-architecture` memoir export confirmed the archived subsystem
  concepts remain preserved.
- TASK-2026-001 was moved to `📦 Archivado` on `2026-05-26`.




