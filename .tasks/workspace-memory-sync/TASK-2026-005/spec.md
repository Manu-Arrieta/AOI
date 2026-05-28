# Feature Specification: Export e Importacion de Bundles de Memoria Comprimidos

**Feature Branch**: `2026-005-workspace-memory-sync-bundles`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: Requerimientos del Owner para exportar e importar versiones de
memoria governadas como bundles comprimidos, portables y auditables, sin romper
el lifecycle actual de candidata, revision, activacion y rollback.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Exportacion Portable y Delimitada (Priority: P1)

Como Owner, quiero exportar una version explicita de memoria a un bundle
comprimido completo o parcial por scopes, para poder trasladarla o respaldarla
sin depender del workspace origen en tiempo real.

**Why this priority**: Sin un artefacto portable con limites declarados, no
existe la capacidad nueva que motiva la feature.

**Independent Test**: Comprobable preparando una exportacion con un subconjunto
de scopes y verificando que el bundle resultante declara procedencia, scopes
incluidos y scopes omitidos, y que queda materializado dentro de
`.exportsmemories/`.

**Acceptance Scenarios**:

1. **Given** una version de memoria valida y seleccion de scopes explicita,
   **When** el Owner solicita la exportacion, **Then** el sistema genera un
  bundle comprimido dentro de `.exportsmemories/` con su descriptor de
  procedencia y exclusion.
2. **Given** una exportacion parcial, **When** el bundle queda materializado,
   **Then** el sistema deja claro que el artefacto no representa una version
   completa fuera de los scopes incluidos.

---

### User Story 2 - Importacion con Validacion Estricta (Priority: P1)

Como Owner, quiero que la importacion de un bundle portable valide primero su
procedencia, compatibilidad e integridad, para impedir ingestiones opacas,
corruptas o incompatibles.

**Why this priority**: La capacidad offline solo es segura si el sistema puede
rechazar artefactos incorrectos antes de tocar la memoria del workspace destino.

**Independent Test**: Comprobable intentando importar un bundle malformado o
incompatible y verificando que la operacion falla sin generar una version
candidata.

**Acceptance Scenarios**:

1. **Given** un bundle sin metadatos requeridos o con integridad invalida,
   **When** comienza la importacion, **Then** el sistema aborta sin mutar el
   estado activo ni crear una candidata.
2. **Given** un bundle valido, **When** supera la validacion de ingreso,
   **Then** el sistema lo convierte en una fuente apta para preparar una nueva
   version candidata del workspace destino.

---

### User Story 3 - Revision Gobernada del Owner (Priority: P1)

Como Owner, quiero revisar el contenido importado desde bundle y decidir que se
retiene, que se complementa y que se descarta, para mantener jurisdiccion plena
sobre la memoria del workspace destino.

**Why this priority**: La feature anterior definio que el Owner conserva la
decision final sobre la unificacion de memoria; el bundle no puede debilitar esa
frontera.

**Independent Test**: Comprobable importando un bundle valido, ajustando
`retain/complement/discard`, y verificando que la version candidata refleje esa
decision antes de activarse.

**Acceptance Scenarios**:

1. **Given** un bundle valido y una version candidata en revision,
   **When** el Owner define sus decisiones de integracion, **Then** el sistema
   prepara la candidata respetando esa clasificacion y detiene la activacion
   hasta aprobacion explicita.

---

### User Story 4 - Activacion y Rollback Consistentes (Priority: P1)

Como Owner, quiero que una version activada desde bundle mantenga el mismo
contrato de activacion y rollback que una sincronizacion en vivo, para poder
restaurar rapidamente el estado previo si la importacion degrada la memoria.

**Why this priority**: El bundle agrega un nuevo origen de informacion, pero no
debe crear un segundo sistema de versionado ni una reversibilidad inferior.

**Independent Test**: Comprobable activando una candidata derivada de bundle y
ejecutando despues un rollback exitoso hacia la version previa restaurable.

**Acceptance Scenarios**:

1. **Given** una candidata derivada de bundle y aprobada por el Owner,
   **When** se activa la nueva version, **Then** el sistema conserva referencia
   al bundle de origen y mantiene la version previa como rollback inmediato.
2. **Given** una version activada desde bundle, **When** el Owner ordena
   rollback, **Then** el sistema restaura la version previa sin requerir un
   nuevo merge ni edicion manual de artefactos.

## Constitution Alignment _(mandatory)_

### Existing Surface Discovery

- Existing services, prompts, and runtime surfaces affected:
  - Infraestructura de versionado bajo `.specify/memory/versions/**`.
  - Scripts Node en `scripts/memory-sync/**` que hoy resuelven, preparan,
    activan y revierten versiones.
  - Workflows existentes `/sync-workspace-memory` y
    `/rollback-workspace-memory`, que seguiran siendo el baseline para el
    lifecycle live y la reversibilidad.
- Copilot, Antigravity, and `scaffold/` sync impact:
  - Nuevos prompts bajo `.github/prompts/` y sus mirrors en
    `scaffold/.github/prompts/`.
  - Nuevos skills Antigravity bajo `.agent/skills/` y sus mirrors en
    `scaffold/.agent/skills/`.
  - Registro/documentacion de workflows en `.atl/skill-registry.md`,
    `scaffold/.atl/skill-registry.md`, `GEMINI.md` y `scaffold/GEMINI.md`.
- Tooling and platform impact:
  - Workflow-first, local filesystem, Node.js e ICM CLI existentes.
  - Carpeta base gobernada `.exportsmemories/` en root y su mirror en
    `scaffold/` para artefactos de exportacion.
  - No se agregan `.resources/` ni se extiende el dashboard en esta iteracion.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El flujo de exportacion DEBE exigir workspace, version y scopes
  explicitamente antes de generar un bundle.
- **FR-001A**: El sistema DEBE materializar los bundles exportados bajo la
  carpeta base `.exportsmemories/`, evitando rutas de salida arbitrarias fuera
  de esa superficie gobernada.
- **FR-002**: El sistema DEBE soportar exportaciones completas o parciales por
  scopes `memories`, `memoir` y `feedback`.
- **FR-003**: Todo bundle comprimido DEBE incluir un descriptor verificable con
  workspace origen, version origen, fecha de exportacion, version de formato,
  scopes incluidos y scopes omitidos.
- **FR-004**: El sistema DEBE rechazar importaciones de bundles malformados,
  incompatibles o sin integridad verificable antes de preparar cualquier
  candidata.
- **FR-005**: Un bundle valido DEBE convertirse en una nueva version candidata
  del workspace destino, nunca en una activacion automatica.
- **FR-006**: La revision del Owner DEBE seguir exigiendo decisiones
  `retain`, `complement` y `discard` antes de activar una version importada.
- **FR-007**: Los manifests derivados de bundle DEBEN conservar trazabilidad
  hacia el artefacto transportado y su procedencia declarada.
- **FR-008**: Una version activada desde bundle DEBE conservar la misma
  elegibilidad de rollback explicito que cualquier otra version activa del
  workspace.
- **FR-009**: La importacion desde bundle y la sincronizacion directa entre
  workspaces DEBEN permanecer como dos entry points de un mismo modelo de
  gobernanza, no como sistemas de versionado paralelos.

### Key Entities

- **Compressed Memory Bundle**: Artefacto portable y comprimido que encapsula un
  snapshot exportable de memoria junto con su descriptor de procedencia.
- **Bundle Provenance Descriptor**: Metadata auditable que declara origen,
  version, formato, integridad, scopes incluidos y scopes omitidos.
- **Bundle-Sourced Candidate Manifest**: Manifest de version candidata generado
  en el workspace destino a partir de un bundle validado y pendiente de revision
  del Owner.
- **Scope Selection Matrix**: Declaracion explicita de que scopes viajan y cuales
  quedan excluidos del bundle.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: El Owner puede generar un bundle comprimido valido desde una
  version explicita sin depender de una conexion viva a otro workspace y el
  artefacto queda ubicado bajo `.exportsmemories/`.
- **SC-002**: Los bundles parciales dejan documentado de forma visible que
  contenido fue omitido.
- **SC-003**: Los bundles incompatibles o corruptos son rechazados sin alterar
  el estado activo ni crear manifests candidatos.
- **SC-004**: Una importacion valida produce una version candidata revisable y
  auditable antes de cualquier activacion.
- **SC-005**: Una version activada desde bundle puede restaurarse mediante el
  mismo rollback explicito ya definido para memoria versionada.

## Assumptions

- La primera iteracion se mantiene workflow-first y no requiere UI dentro de
  `apps/agentic-ops-dashboard/`.
- No hay `.resources/` explicitamente vinculados y por lo tanto no se crea ni se
  modifica `relations.json`.
- `.exportsmemories/` se trata como carpeta base del repositorio para bundles
  exportados, con placeholder trackeado y artefactos generados ignorados por
  git.
- La implementacion puede apoyarse en capacidades reales del ICM CLI existentes
  para listar/consultar memorias y exportar memoirs, sin asumir una API nativa
  de exportacion total de memorias que hoy no existe.
- El formato comprimido puede resolverse con tooling Node portable, sin agregar
  dependencias externas pesadas ni archivers propietarios.