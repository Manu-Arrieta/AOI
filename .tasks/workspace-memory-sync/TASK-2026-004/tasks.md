# Tasks: Sincronización y Versionado de Memorias ICM

**Input**: Design documents from `.tasks/workspace-memory-sync/TASK-2026-004/`  
**Prerequisites**: `implementation-plan.md`, `spec.md`, `design.md`

**Tests**: Se requiere validación ejecutable de resolución de versión activa,
manifests candidatos, activación de versión y rollback íntegro mediante
`node --test`, además de validación enfocada de markdown/json y parity entre
repo vivo y `scaffold/`.

**Organization**: Las tareas se agrupan por foundations, flujos funcionales y
polish para implementar primero el contrato de gobernanza y luego las
operaciones de sync/rollback.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo cuando no hay solapamiento de archivos.
- **[Story]**: `Foundation`, `US1`, `US2`, `US3` o `Polish`.
- Cada tarea incluye paths exactos del repositorio.

## Path Conventions

- La gobernanza raíz vive en `.specify/memory/constitution.md`.
- El estado versionado de memoria vive en `.specify/memory/versions/**`.
- Los workflows de usuario viven en `.github/prompts/` y sus mirrors en
  `scaffold/.github/prompts/`.
- El protocolo ICM compartido vive en `.github/instructions/` y
  `.agent/skills/_shared/`, con mirrors equivalentes en `scaffold/`.
- La automatización mínima vive en `scripts/memory-sync/`.
- La documentación operativa vive en `README.md` y `README.es.md`.

## Constitution-Driven Task Types

- Añadir tareas espejo siempre que se toquen constituciones, prompts o
  instrucciones compartidas en root y `scaffold/`.
- Mantener coherencia entre Copilot y Antigravity en el protocolo ICM
  compartido; no basta con tocar sólo `.github/`.
- Asegurar validación ejecutable para los artefactos de versión y rollback,
  no sólo revisión manual.

## Phase 1: Foundations (Blocking Prerequisites)

**Purpose**: Establecer el contrato de gobernanza y la estructura de artefactos
versionados antes de introducir workflows o activaciones.

- [x] T001 [Foundation] Actualizar
      `.specify/memory/constitution.md` y
      `scaffold/.specify/memory/constitution.md` para declarar el sistema de
      memoria versionada, snapshots constitucionales dinámicos, regla de versión
      activa y obligación de rollback restaurable.
- [x] T002 [Foundation] Crear la estructura administrada bajo
      `.specify/memory/versions/` y `scaffold/.specify/memory/versions/`,
      incluyendo `README.md`, `active.json`, `manifests/`, `constitutions/` y
      `templates/` con `memory-version.template.json` y
      `dynamic-constitution.template.md`.
- [x] T003 [Foundation] Crear el schema base y el resolvedor de versión activa en
      `scripts/memory-sync/schema.mjs` y
      `scripts/memory-sync/resolve-active-version.mjs`, y exponer la validación
      necesaria en `package.json`.
- [x] T004 [Foundation] Agregar validación ejecutable para schema y resolución de
      versión activa en `scripts/memory-sync/resolve-active-version.test.mjs` y
      fixtures adyacentes bajo `scripts/memory-sync/fixtures/`.

**Checkpoint**: El repo puede describir y validar una versión activa de memoria
sin ambigüedad.

---

## Phase 2: User Story 1 - Resolución Explícita de Origen (Priority: P1)

**Goal**: Forzar que toda sincronización conozca workspace fuente y versión
fuente antes de planificar cualquier merge.

**Independent Test**: Un flujo de sync sin workspace o versión de origen falla
rápidamente, y un flujo bien formado puede materializar un candidato con esa
información resuelta desde el inicio.

### Validation for User Story 1

- [x] T005 [US1] Extender las pruebas Node para cubrir entradas inválidas,
      ausencia de `active.json` y resolución incorrecta de workspace/version en
      `scripts/memory-sync/resolve-active-version.test.mjs` y fixtures asociadas.

### Implementation for User Story 1

- [x] T006 [US1] Actualizar el protocolo ICM compartido en
      `.github/instructions/icm-protocol.instructions.md`,
      `.agent/skills/_shared/icm-protocol.md` y sus mirrors en `scaffold/` para
      exigir resolución version-aware antes de cualquier recall/store operativo.
- [x] T007 [US1] Crear el workflow gobernado en
      `.github/prompts/sync-workspace-memory.prompt.md` y
      `scaffold/.github/prompts/sync-workspace-memory.prompt.md` para exigir
      workspace fuente, versión fuente, scopes opcionales y contexto del Owner
      antes de preparar un sync.

**Checkpoint**: El sistema ya no puede iniciar syncs ambiguos y el contrato de
resolución está alineado entre prompts e instrucciones compartidas.

---

## Phase 3: User Story 2 - Importación Guiada y Activación Controlada (Priority: P1)

**Goal**: Permitir imports totales o parciales, con contexto del Owner, plan
retain/complement/discard y activación explícita de una nueva versión.

**Independent Test**: El workflow puede producir un manifest candidato con
alcance seleccionado, contexto directivo y decisiones de merge antes de activar
una nueva versión.

### Validation for User Story 2

- [x] T008 [US2] Agregar validación Node para manifests candidatos y decisiones
      `retain/complement/discard` en
      `scripts/memory-sync/prepare-version-manifest.test.mjs` con fixtures que
      cubran importaciones completas y parciales.

### Implementation for User Story 2

- [x] T009 [US2] Implementar la generación de manifests candidatos en
      `scripts/memory-sync/prepare-version-manifest.mjs` usando los templates de
      `.specify/memory/versions/templates/`.
- [x] T010 [US2] Implementar la activación de versiones en
      `scripts/memory-sync/activate-version.mjs` y su prueba asociada en
      `scripts/memory-sync/activate-version.test.mjs`, incluyendo actualización
      de `active.json`, referencias a `previousVersionId` y vínculo al snapshot
      constitucional dinámico.
- [x] T011 [US2] Extender el workflow de sync y los templates de
      `.specify/memory/versions/templates/` para que el plan retain/complement/discard,
      la aprobación del Owner y la constitución dinámica sean obligatorios antes
      de la activación.

**Checkpoint**: El workflow puede preparar y activar una nueva versión de
memoria de forma auditable y siempre bajo aprobación explícita.

---

## Phase 4: User Story 3 - Rollback Seguro y Explícito (Priority: P1)

**Goal**: Restaurar una versión previa válida cuando la memoria activa resulte
corrupta, inconsistente o degradada.

**Independent Test**: Después de activar una versión nueva, el sistema puede
volver a una versión anterior válida y dejar el puntero activo, los manifests y
los snapshots en un estado consistente.

### Validation for User Story 3

- [x] T012 [US3] Agregar cobertura Node para rollback válido, target inválido y
      ausencia de versión previa en
      `scripts/memory-sync/rollback-version.test.mjs` con fixtures de ciclo de
      vida de versiones.

### Implementation for User Story 3

- [x] T013 [US3] Implementar la restauración íntegra en
      `scripts/memory-sync/rollback-version.mjs`, reactivando la versión previa
      y marcando la versión revertida con trazabilidad explícita.
- [x] T014 [US3] Crear el workflow gobernado en
      `.github/prompts/rollback-workspace-memory.prompt.md` y
      `scaffold/.github/prompts/rollback-workspace-memory.prompt.md` para exigir
      selección de versión objetivo, motivo del rollback y persistencia del
      evento en ICM.

**Checkpoint**: El workspace puede volver de forma confiable a una versión
anterior sin reconstrucciones manuales.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Documentar, alinear y validar toda la superficie compartida.

- [x] T015 [P] [Polish] Actualizar `README.md` y `README.es.md` para documentar
      la memoria versionada, el árbol `.specify/memory/versions/`, el workflow
      de sync y el workflow de rollback.
- [x] T016 [Polish] Ejecutar validación enfocada sobre
      `scripts/memory-sync/*.test.mjs`, validar templates markdown/json y
      comprobar parity entre root y `scaffold/` para prompts, instrucciones y
      constituciones cambiadas.

## Dependencies & Execution Order

### Phase Dependencies

- **Foundation (Phase 1)**: empieza inmediatamente y bloquea el resto.
- **US1 (Phase 2)**: depende de la gobernanza y del resolvedor de versión.
- **US2 (Phase 3)**: depende de la resolución explícita y de los templates de
  manifests.
- **US3 (Phase 4)**: depende de activación y trazabilidad de versiones previas.
- **Polish (Phase 5)**: depende de todas las superficies deseadas completas.

### User Story Dependencies

- **US1**: depende de T001-T004.
- **US2**: depende de T006-T010.
- **US3**: depende de T009-T010 para tener una versión activa restaurable.

### Parallel Opportunities

- T001 y T002 pueden avanzar en secuencia corta antes de T003.
- T005 puede correr en paralelo con T006 una vez exista el árbol base.
- T008 puede prepararse mientras T007 define el workflow de sync.
- T012 puede diseñarse en paralelo con T013 una vez T010 estabilice activación.
- T015 puede correr en paralelo con cierre técnico antes de T016.

## Implementation Strategy

### MVP First

1. Gobernanza de memoria versionada y árbol `.specify/memory/versions/`
2. Resolución de versión activa y validación ejecutable
3. Workflow de sync con manifests candidatos y activación explícita
4. Workflow de rollback con restauración íntegra
5. Documentación y validación de parity

### Incremental Delivery

1. Contracts + manifests
2. Resolver + tests
3. Sync prompt + candidate generation
4. Activation flow
5. Rollback flow
6. Docs + validation