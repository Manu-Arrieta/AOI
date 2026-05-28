# Context — TASK-2026-005

- Feature: `workspace-memory-sync`
- Title: `Export and import compressed workspace memory bundles`
- Status: `📦 Archivado`
- Created: `2026-05-27`
- Owner: `Supervisor`

## Owner Intent

Extender la sincronización versionada de memoria para que el Owner pueda
exportar una versión gobernada de memoria a un formato comprimido y portable, y
luego importar ese bundle en otro workspace o en otra sesión sin depender de un
workspace fuente accesible en vivo. La importación debe mantener trazabilidad,
validación de procedencia, selección de scopes, revisión previa y la misma
seguridad operacional de candidata, activación y rollback que hoy existe para
la sync directa entre workspaces. Además, los artefactos generados por la
exportación deben vivir bajo una carpeta base gobernada del repositorio:
`.exportsmemories/`.

## Initial State

- El repo ya tiene infraestructura version-aware bajo `.specify/memory/versions/`
  con `active.json`, manifests, snapshots constitucionales y un resolver de
  versión activa.
- El workflow `/sync-workspace-memory` hoy exige `sourceWorkspace` y
  `sourceVersionId`; prepara manifests candidatos, pero no define un artefacto
  portable/exportable para transportar memoria fuera de ese vínculo directo.
- `scripts/memory-sync/` cubre resolución, preparación, activación y rollback,
  pero no modela serialización compacta, empaquetado, integridad ni validación
  de import bundles.
- El dashboard sigue sin read-model de memorias/versiones; la superficie actual
  para este dominio continúa siendo workflow-first.
- No se detectó soporte actual para export/import comprimido en prompts,
  scripts, esquemas ni documentación del repo.
- No existe todavía una carpeta base dedicada para centralizar artefactos de
  exportación de memoria dentro del repo.

## Exploration Focus

- Delimitar si el bundle comprimido representa una exportación completa de una
  versión de memoria o también debe soportar exportación parcial por scopes.
- Determinar qué metadatos mínimos debe cargar el bundle: workspace origen,
  versionId origen, scopes incluidos, formato/version del bundle, compatibilidad
  de gobernanza y marcas de integridad.
- Evaluar si la importación desde bundle debe converger en el mismo contrato de
  candidata, review, activación y rollback que el flujo actual.
- Analizar cómo preservar auditabilidad y seguridad operacional cuando la fuente
  ya no es un workspace consultable en vivo sino un artefacto portátil.

## Exploration Outcome

- El contrato base reutilizable ya existe en `resolve-active-version`,
  `prepare-version-manifest`, `activate-version` y `rollback-version`.
- El prompt `/sync-workspace-memory` puede funcionar como baseline para el gate
  operativo, pero hoy asume una fuente viva (`sourceWorkspace` +
  `sourceVersionId`) y no contempla un transporte offline.
- La ausencia de un paquete portable obliga a introducir un artefacto gobernado
  nuevo, no sólo a agregar un flag al flujo actual.
- La recomendación es conservar un único lifecycle versionado
  (`candidate -> review -> activate -> rollback`) y permitir que tanto la sync
  directa como la importación desde bundle lo alimenten.
- La UI del dashboard queda fuera de este primer corte porque el gap actual es
  de contrato, validación y persistencia, no de presentación.

## Proposal Outcome

- `proposal.md` fue redactado con una recomendación centrada en exportar e
  importar bundles comprimidos de memoria sin romper el versionado gobernado ya
  implementado.
- `TASK-2026-005` fue registrado en `.tasks/registry.md` con estado
  `📋 Propuesto` a la espera de aprobación del Owner para avanzar a `/sdd-ff`.

## Approval

- Proposal approved by Owner on `2026-05-28`.
- Handoff initiated to `@functional-analyst` and `@solution-architect` for the
  planning artifacts of `/sdd-ff`.
- `TASK-2026-005` moved into planning to produce `requirement.md`, `spec.md`,
  `design.md`, `tasks.md` and `implementation-plan.md`.

## Requirement Outcome

- El requirement formaliza el bundle comprimido como artefacto portable de
  transporte y auditoria, con exportacion explicita, seleccion parcial por
  scopes y rechazo temprano de bundles incompatibles o corruptos.
- Se mantiene la frontera funcional de la feature anterior: la importacion desde
  bundle no puede activar directamente y la decision final sigue en manos del
  Owner.
- Quedaron fuera de alcance el dashboard, `.resources/` y cualquier transporte
  remoto administrado por el sistema.

## Specification Outcome

- `spec.md` organiza el slice en cuatro historias de usuario: exportacion
  portable, validacion estricta de ingreso, revision gobernada del Owner y
  consistencia de activacion/rollback para versiones derivadas de bundle.
- Los requerimientos funcionales fijan bundle provenance obligatoria, candidata
  obligatoria previa a activacion y continuidad del modelo unico de gobernanza
  entre sync live y transporte offline.
- La especificacion reconoce las superficies impactadas: `.specify/`,
  `scripts/memory-sync/`, prompts/skills nuevos, registry/GEMINI y mirrors en
  `scaffold/`, manteniendo fuera de alcance el dashboard.

## Planning Outcome

- `design.md` recomienda un bundle como envelope JSON comprimido con `gzip`
  para mantener portabilidad cross-platform y evitar dependencias nuevas de
  archivado.
- El plan incorpora `.exportsmemories/` como carpeta base gobernada para los
  bundles exportados, con mirror equivalente en `scaffold/` y artefactos
  runtime ignorados por git.
- El plan tecnico reutiliza el lifecycle existente de manifests versionados,
  extendiendo templates y scripts para preservar trazabilidad bundle-aware en
  candidatas, activaciones y rollback.
- `tasks.md` descompone la feature en 16 tareas a traves de foundations,
  exportacion, importacion, lifecycle bundle-aware y polish, con validacion
  ejecutable via `node --test`.
- `TASK-2026-005` queda listo para `/sdd-apply` una vez el Owner apruebe los
  artefactos de planning.

## Implementation Progress

- `/sdd-apply` comenzo el `2026-05-28` tras la aprobacion del Owner.
- Se completo el foundation slice del contrato bundle-aware: manifests con
  `sourceTransport`, metadata bundle opcional, template `memory-bundle`,
  utilidades `gzip` y pathing gobernado bajo `.exportsmemories/`.
- Se agregaron fixtures validos e invalidos para bundles y un test dedicado de
  `bundle-contract`, manteniendo verde la suite enfocada de
  `scripts/memory-sync`.

## Implementation Outcome

- `scripts/memory-sync/export-memory-bundle.mjs` implementa la exportacion de
  versiones explicitas hacia `*.memory-bundle.json.gz` dentro de
  `.exportsmemories/`, incluyendo declaracion de scopes incluidos/omitidos e
  integridad `sha256`.
- `scripts/memory-sync/import-memory-bundle.mjs` valida procedencia, formato e
  integridad del bundle antes de preparar una candidata bundle-aware mediante
  `prepare-version-manifest.mjs`.
- `scripts/memory-sync/export-memory-bundle.test.mjs`,
  `import-memory-bundle.test.mjs` y `bundle-lifecycle.test.mjs` cubren
  exportacion completa/parcial, rechazo de bundles invalidos y preservacion de
  trazabilidad bundle durante activacion y rollback.
- Se agregaron los workflows `/export-memory-bundle` y
  `/import-memory-bundle` en Copilot, sus mirrors Antigravity, registro
  compartido, `GEMINI.md`, `README.md`, `README.es.md` y `scaffold/`.

## Verification Outcome

- `verify-report.md` fue creado con `PASS` tras validar FR-001 a FR-009,
  bundle contract, importacion a candidata, lifecycle bundle-aware y parity
  entre root y `scaffold/`.
- `pnpm test:memory-sync` y `pnpm test:memory-sync:bundle` pasaron con `fail 0`.
- La evidencia de Service Discovery fue confirmada en
  `aoi-services-catalog` y el health audit de ICM quedo saludable para los
  topics `aoi-*` relevantes despues de consolidar `aoi-context`,
  `aoi-services-catalog` y `aoi-session-summaries`.
- `TASK-2026-005` queda implementado y listo para decision del Owner: archivar,
  seguir iterando o volver a verificar si cambia el contrato.

## Archive Complete

- `/sdd-archive` cerro formalmente `TASK-2026-005` el `2026-05-28` tras el
  PASS de verify.
- `functional-docs.md` y `archive-report.md` documentan el flujo operativo
  final para bundles comprimidos y las decisiones de cierre.
- El estado del task en `.tasks/registry.md` paso a `📦 Archivado` con fecha de
  cierre `2026-05-28`.
- El topic `sdd-aoi-workspace-memory-sync-TASK-2026-005` queda consolidado
  y resumido en ICM junto con el cierre de sesion.
- El transcript de archive quedo registrado bajo `01KSQFNNR6E3NGSGJ8ZDQ7FGQ9` y
  el memoir `aoi-architecture` fue exportado a
  `architecture-memoir-export.json` dentro del directorio del task.