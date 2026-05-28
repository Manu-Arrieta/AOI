# Architecture & Design: Sincronización y Versionado de Memorias ICM

**Branch**: `2026-004-workspace-memory-sync` | **Date**: 2026-05-27  
**Input**: `.tasks/workspace-memory-sync/TASK-2026-004/spec.md`

## Summary

Esta iteración implementa la sincronización de memorias como una capacidad
workflow-first de la infraestructura agéntica, no como una extensión inicial
del dashboard. El diseño combina artefactos de versión bajo
`.specify/memory/versions/`, prompts gobernados para sincronizar y revertir,
actualizaciones al protocolo ICM compartido, y un set pequeño de scripts Node
en la raíz del workspace para validar manifests, resolver la versión activa,
activar una nueva versión y restaurar una previa. El objetivo es hacer explícito
el contrato operativo de memoria por workspace sin depender de una UI ni de una
reescritura del runtime existente.

## Current State

- El proyecto ya usa ICM de forma obligatoria, pero el acceso operativo sigue
  apoyándose en topics canónicos por workspace como `aoi-context` sin una
  capa explícita de resolución de versión activa.
- La gobernanza raíz vive en `.specify/memory/constitution.md`, aunque todavía
  no define manifests de versión, snapshots constitucionales por versión ni un
  flujo formal de rollback.
- El runtime existente con integración a ICM está concentrado en
  `apps/agentic-ops-dashboard/`, pero esta feature no requiere todavía una UI ni
  debe depender del dashboard para operar.
- Las instrucciones y prompts actuales de `.github/` y `.agent/` asumen acceso
  directo a topics y memoirs del workspace, por lo que quedarían ambiguos una
  vez exista más de una versión de memoria activa o restaurable.

## Design Goals

1. Resolver siempre `workspace + memory version` antes de leer o escribir
   memoria operativa.
2. Mantener la sincronización bajo control explícito del Owner, con contexto
   adicional y selección total o parcial.
3. Materializar manifests inmutables y snapshots constitucionales dinámicos por
   versión.
4. Habilitar activación y rollback explícitos sin reconstrucciones manuales.
5. Mantener paridad entre repo vivo, `scaffold/`, Copilot y Antigravity.
6. Dar una base testeable y automatizable sin abrir aún una superficie de UI.

## Workflow-First Memory Sync Model

### Governance Layer

La gobernanza de memoria se divide en dos niveles complementarios.

- La constitución raíz (`.specify/memory/constitution.md`) sigue siendo la
  autoridad normativa del proyecto y define las reglas del sistema de versiones
  de memoria.
- Cada versión operativa de memoria queda acompañada por un snapshot
  constitucional dinámico que captura el estado funcional aprobado para esa
  versión concreta.

La constitución raíz no debe mutar en cada sync. Su rol es definir las reglas
del juego; los snapshots dinámicos documentan el resultado de cada activación.

### Version Artifact Model

La fuente de verdad para el estado operativo de memoria pasa a vivir en un árbol
administrado bajo `.specify/memory/versions/`.

```text
.specify/memory/versions/
├── README.md
├── active.json
├── manifests/
│   └── {workspace}/
│       └── {memory-version}.json
├── constitutions/
│   └── {workspace}/
│       └── {memory-version}.md
└── templates/
    ├── memory-version.template.json
    └── dynamic-constitution.template.md
```

#### `active.json`

- apunta a la versión activa por workspace
- conserva referencia explícita a la versión previa restaurable
- evita que el resto del sistema tenga que inferir desde topics globales

#### Manifests de Versión

Cada manifest representa una versión inmutable e incluye, como mínimo:

- `workspace`
- `versionId`
- `previousVersionId`
- `sourceWorkspace`
- `sourceVersionId`
- scopes seleccionados (`memories`, `memoir`, `feedback`)
- contexto provisto por el Owner
- decisiones `retain`/`complement`/`discard`
- estado (`candidate`, `active`, `rolled-back`, `superseded`)
- referencias al snapshot constitucional dinámico

#### Snapshot Constitucional Dinámico

Cada versión activa o candidata persistida produce un documento markdown
versionado que describe:

- alcance del merge
- reglas activas de retención y descarte
- límites del rollback
- motivo u objetivo del sync
- responsabilidades explícitas del Owner

### Helper Script Model

La automatización mínima vive en `scripts/memory-sync/` para no acoplar la
capacidad al dashboard ni forzar un nuevo paquete de workspace.

```text
scripts/memory-sync/
├── schema.mjs
├── resolve-active-version.mjs
├── prepare-version-manifest.mjs
├── activate-version.mjs
├── rollback-version.mjs
└── *.test.mjs
```

#### Responsabilidades

- `schema.mjs`: valida la forma de `active.json`, manifests y snapshots
  referenciados.
- `resolve-active-version.mjs`: resuelve la versión activa del workspace y la
  versión previa restaurable.
- `prepare-version-manifest.mjs`: materializa un manifest candidato desde la
  selección del Owner y el plan retain/complement/discard.
- `activate-version.mjs`: promueve un manifest candidato a activo y actualiza
  `active.json` sin ambigüedad.
- `rollback-version.mjs`: re-activa una versión previa válida y marca la
  versión actual como revertida o supersedida según corresponda.

Los scripts no reemplazan al agente: encapsulan validaciones y mutaciones
deterministas de artefactos. La decisión de negocio y el plan de sync siguen en
manos del workflow y del Owner.

### Workflow Surface Model

La primera iteración introduce dos workflows explícitos:

- `.github/prompts/sync-workspace-memory.prompt.md`
- `.github/prompts/rollback-workspace-memory.prompt.md`

Ambos deben existir también en `scaffold/.github/prompts/`.

#### Sync Workflow

- exige workspace fuente y versión fuente
- permite selección total o parcial
- acepta contexto adicional del Owner
- construye un plan retain/complement/discard
- escribe un manifest candidato y su snapshot dinámico
- exige confirmación explícita antes de activar

#### Rollback Workflow

- resuelve la versión activa actual y las versiones elegibles para restauración
- exige motivo y versión objetivo de rollback
- reactiva la versión previa sin merge adicional
- persiste el evento como cambio gobernado de memoria

### Shared ICM Resolution Model

El protocolo ICM compartido debe actualizarse tanto en Copilot como en
Antigravity para reflejar la nueva capa de resolución:

- `.github/instructions/icm-protocol.instructions.md`
- `.agent/skills/_shared/icm-protocol.md`
- `scaffold/.github/instructions/icm-protocol.instructions.md`
- `scaffold/.agent/skills/_shared/icm-protocol.md`

La regla nueva es simple: cuando el workspace use memoria versionada, las
operaciones de recall/store no deben asumir un alias bare sin pasar primero por
`active.json` o por una versión explícitamente indicada por el Owner.

### Activation & Rollback Model

La activación y la reversión se tratan como transiciones de estado sobre
artefactos, no como mutaciones implícitas del prompt.

- Un sync produce primero un manifest `candidate`.
- Sólo tras aprobación explícita del Owner, el candidato pasa a `active`.
- La versión previamente activa queda referenciada como restaurable.
- Un rollback reescribe el puntero activo hacia una versión anterior válida y
  conserva trazabilidad del motivo del retorno.

Esto hace que “versionar” no signifique solo generar snapshots, sino también
tener una operación íntegra de recuperación.

## Sync Surfaces

### Live Repository

- `.specify/memory/constitution.md`
- `.specify/memory/versions/**`
- `.github/prompts/sync-workspace-memory.prompt.md`
- `.github/prompts/rollback-workspace-memory.prompt.md`
- `.github/instructions/icm-protocol.instructions.md`
- `.agent/skills/_shared/icm-protocol.md`
- `scripts/memory-sync/**`
- `package.json`
- `README.md`
- `README.es.md`

### Scaffold Mirrors

- `scaffold/.specify/memory/constitution.md`
- `scaffold/.specify/memory/versions/**`
- `scaffold/.github/prompts/sync-workspace-memory.prompt.md`
- `scaffold/.github/prompts/rollback-workspace-memory.prompt.md`
- `scaffold/.github/instructions/icm-protocol.instructions.md`
- `scaffold/.agent/skills/_shared/icm-protocol.md`

## Validation Strategy

La validación debe ser ejecutable y enfocada en el contrato mínimo:

- pruebas Node sobre parseo y validación de manifests
- pruebas Node sobre resolución de versión activa
- pruebas Node sobre activación y rollback de versiones
- validación de JSON/Markdown en artefactos generados
- revisión de paridad entre repo vivo y `scaffold/` en prompts, constitución e
  instrucciones compartidas

El comando esperado de smoke validation para la feature debe ser algo del estilo:

```text
node --test scripts/memory-sync/*.test.mjs
```

## Risks and Mitigations

- **Deriva entre herramientas**: si Copilot y Antigravity no reciben el mismo
  contrato de resolución, el sistema queda inconsistente. Mitigación: tratar el
  protocolo ICM compartido como superficie dual obligatoria.
- **Rollback incompleto**: si sólo se mueve el puntero activo sin restaurar el
  snapshot constitucional y las referencias del manifest, la reversión sería
  engañosa. Mitigación: modelar rollback como transición íntegra sobre artefactos.
- **Sobrecarga del flujo**: demasiada automatización temprana podría opacar la
  decisión humana. Mitigación: mantener prompts y scripts separados, con
  aprobación explícita del Owner antes de activar.
- **Acoplamiento al dashboard**: mover esta lógica al runtime UI en la primera
  iteración aumentaría el alcance y reduciría portabilidad. Mitigación: mantener
  la feature como infraestructura workflow-first.