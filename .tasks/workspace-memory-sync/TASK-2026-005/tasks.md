# Tasks: Exportacion e Importacion de Bundles de Memoria Comprimidos

**Input**: Design documents from `.tasks/workspace-memory-sync/TASK-2026-005/`  
**Prerequisites**: `implementation-plan.md`, `spec.md`, `design.md`

**Tests**: Se requiere validacion ejecutable de exportacion, importacion,
integridad de bundles, candidata derivada de bundle, activacion y rollback
mediante `node --test`, ademas de validacion de markdown/json y parity entre
root, `scaffold`, Copilot y Antigravity.

**Organization**: Las tareas se agrupan por foundations, exportacion,
importacion y polish para introducir primero el contrato portable y despues
integrarlo al lifecycle de memoria versionada ya existente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo cuando no hay solapamiento de archivos.
- **[Story]**: `Foundation`, `US1`, `US2`, `US3` o `Polish`.
- Cada tarea incluye paths exactos del repositorio.

## Path Conventions

- La memoria versionada vive en `.specify/memory/versions/**`.
- Los workflows Copilot viven en `.github/prompts/`.
- Los workflows Antigravity viven en `.agent/skills/`.
- El registro de workflows compartidos vive en `.atl/skill-registry.md` y
  `GEMINI.md`.
- La automatizacion minima vive en `scripts/memory-sync/`.
- Los bundles exportados viven bajo `.exportsmemories/` y su mirror en
      `scaffold/.exportsmemories/`.
- La documentacion operativa vive en `README.md` y `README.es.md`.

## Constitution-Driven Task Types

- Añadir tareas espejo siempre que se toquen prompts, skills, templates o
  documentacion compartida en root y `scaffold/`.
- Mantener coherencia entre Copilot y Antigravity en cada workflow nuevo;
  prompts sin skill mirror no cumplen el contrato.
- No crear ni inferir `relations.json`, ya que no hay `.resources/` ligados a
  este task.

## Phase 1: Foundations (Blocking Prerequisites)

**Purpose**: Definir el contrato portable del bundle y la trazabilidad minima
que debe viajar hacia el lifecycle versionado.

- [x] T001 [Foundation] Actualizar `.specify/memory/versions/README.md` y
      `scaffold/.specify/memory/versions/README.md` para documentar el bundle
      comprimido como artefacto de transporte, sus reglas de procedencia,
      integridad, declaracion de scopes omitidos y el uso de `.exportsmemories/`
      como carpeta base de salida.
- [x] T002 [Foundation] Extender
      `.specify/memory/versions/templates/memory-version.template.json` y su
      mirror en `scaffold/` para soportar metadata opcional de fuente bundle, y
      crear `memory-bundle.template.json` en ambos arboles con el envelope
      portable validable; materializar `.exportsmemories/.gitkeep` y
      `scaffold/.exportsmemories/.gitkeep`, junto con las reglas de ignore para
      no versionar bundles generados.
- [x] T003 [Foundation] Extender `scripts/memory-sync/schema.mjs` y
      `scripts/memory-sync/store-utils.mjs` para validar metadata de bundle,
      envelopes comprimidos y helpers de serializacion/deserializacion con
      `gzip`.
- [x] T004 [Foundation] Crear fixtures enfocados bajo
      `scripts/memory-sync/fixtures/valid/` y fixtures adyacentes invalidas para
      cubrir bundles completos, parciales, incompatibles y corruptos.

**Checkpoint**: El repo describe y valida un bundle comprimido sin aun tocar la
activacion de versiones.

---

## Phase 2: User Story 1 - Exportacion Portable y Delimitada (Priority: P1)

**Goal**: Generar bundles comprimidos, completos o parciales, con procedencia e
integridad declaradas.

**Independent Test**: El Owner puede exportar una version explicita a un
`*.memory-bundle.json.gz` y el artefacto deja claros sus scopes incluidos y
omitidos.

### Validation for User Story 1

- [x] T005 [US1] Agregar cobertura Node para exportacion valida, scopes
      parciales y rechazos por seleccion invalida en
      `scripts/memory-sync/export-memory-bundle.test.mjs`.

### Implementation for User Story 1

- [x] T006 [US1] Implementar `scripts/memory-sync/export-memory-bundle.mjs`
      usando el arbol versionado y capacidades reales de ICM para serializar un
      envelope JSON portable, calcular integridad, comprimirlo con `gzip` y
      escribirlo dentro de `.exportsmemories/`.
- [x] T007 [US1] Crear el workflow gobernado en
      `.github/prompts/export-memory-bundle.prompt.md`,
      `scaffold/.github/prompts/export-memory-bundle.prompt.md`,
      `.agent/skills/export-memory-bundle/SKILL.md` y
      `scaffold/.agent/skills/export-memory-bundle/SKILL.md` para exigir
      version, scopes y nombre/subruta relativa dentro de `.exportsmemories/`
      antes de generar el bundle.

**Checkpoint**: El sistema puede producir bundles portables sin ambiguedad sobre
origen, alcance ni integridad.

---

## Phase 3: User Story 2 - Importacion Validada hacia Candidata (Priority: P1)

**Goal**: Ingresar bundles validos al mismo modelo de candidata ya existente,
sin activar automaticamente.

**Independent Test**: Un bundle valido produce una version candidata con
trazabilidad de origen bundle; un bundle invalido falla sin mutar el estado del
workspace destino.

### Validation for User Story 2

- [x] T008 [US2] Agregar cobertura Node para rechazo de bundles corruptos,
      incompatibles o sin procedencia en
      `scripts/memory-sync/import-memory-bundle.test.mjs`.

### Implementation for User Story 2

- [x] T009 [US2] Implementar `scripts/memory-sync/import-memory-bundle.mjs` para
      descomprimir, validar y normalizar bundles validos a un input compatible
      con la preparacion de manifests candidatos.
- [x] T010 [US2] Extender `scripts/memory-sync/prepare-version-manifest.mjs` y
      `scripts/memory-sync/prepare-version-manifest.test.mjs` para persistir
      metadata de transporte bundle (`sourceTransport`, procedencia, scopes,
      integridad y fecha de exportacion) sin autoactivar.
- [x] T011 [US2] Crear el workflow gobernado en
      `.github/prompts/import-memory-bundle.prompt.md`,
      `scaffold/.github/prompts/import-memory-bundle.prompt.md`,
      `.agent/skills/import-memory-bundle/SKILL.md` y
      `scaffold/.agent/skills/import-memory-bundle/SKILL.md`, y actualizar
      `.atl/skill-registry.md` y `scaffold/.atl/skill-registry.md` para registrar
      ambos workflows nuevos.

**Checkpoint**: El sistema convierte bundles validos en candidatas auditables y
rechaza el resto antes de tocar la version activa.

---

## Phase 4: User Story 3 - Activacion y Rollback con Origen Bundle (Priority: P1)

**Goal**: Mantener activacion y rollback consistentes para versiones derivadas de
bundle.

**Independent Test**: Una candidata derivada de bundle puede activarse y luego
volver a la version previa con trazabilidad preservada.

### Validation for User Story 3

- [x] T012 [US3] Agregar una prueba de lifecycle bundle-aware en
      `scripts/memory-sync/bundle-lifecycle.test.mjs` o extender las pruebas de
      `activate-version` y `rollback-version` para cubrir activacion y rollback
      de una version con procedencia bundle.

### Implementation for User Story 3

- [x] T013 [US3] Ajustar `scripts/memory-sync/activate-version.mjs`,
      `scripts/memory-sync/rollback-version.mjs` y los templates necesarios para
      preservar la trazabilidad de transporte bundle despues de activar o
      revertir una version.
- [x] T014 [US3] Actualizar `GEMINI.md`, `scaffold/GEMINI.md`, `README.md` y
      `README.es.md` para documentar `/export-memory-bundle` y
      `/import-memory-bundle`, la carpeta base `.exportsmemories/`, y dejar
      explicita la frontera entre sync live y transporte offline por bundle.

**Checkpoint**: Las versiones originadas en bundles siguen el mismo contrato de
aprobacion, activacion y rollback que las sincronizaciones en vivo.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Alinear tooling, paridad y validacion final del slice completo.

- [x] T015 [P] [Polish] Actualizar `package.json` y `scaffold/package.json` para
      incluir las nuevas pruebas bundle-aware dentro de la superficie de test de
      `memory-sync`.
- [x] T016 [Polish] Ejecutar validacion enfocada sobre
      `scripts/memory-sync/*.test.mjs`, validar templates markdown/json y
      comprobar parity entre root y `scaffold`, y entre Copilot y Antigravity,
      para prompts, skills, registry, templates y la carpeta base
      `.exportsmemories/` agregados o modificados.

## Dependencies & Execution Order

### Phase Dependencies

- **Foundation (Phase 1)**: bloquea el resto porque define envelope, schema y
  fixtures.
- **US1 (Phase 2)**: depende de T001-T004.
- **US2 (Phase 3)**: depende de US1 para reutilizar el contrato de bundle ya
  validado.
- **US3 (Phase 4)**: depende de T009-T010 para tener candidatas derivadas de
  bundle.
- **Polish (Phase 5)**: depende de todas las superficies completadas.

### User Story Dependencies

- **US1**: depende de foundation.
- **US2**: depende de T006 y del schema bundle-aware.
- **US3**: depende de T010 y del lifecycle activo ya existente.

### Parallel Opportunities

- T001 y T002 pueden avanzar en secuencia corta antes de T003.
- T005 puede prepararse en paralelo con T007 una vez el envelope quede definido.
- T008 puede correr en paralelo con T011 una vez T009 estabilice el contrato de
  importacion.
- T014 puede avanzar en paralelo con T012-T013 hacia el cierre tecnico.

## Implementation Strategy

### MVP First

1. Contrato bundle + templates + schema
2. Exportacion comprimida y portable
3. Importacion validada hacia candidata
4. Activacion y rollback bundle-aware
5. Docs, registry y parity

### Incremental Delivery

1. Envelope y trazabilidad
2. Export workflow
3. Import workflow
4. Lifecycle bundle-aware
5. Documentacion y validacion final