# Implementation Plan: Exportacion e Importacion de Bundles de Memoria Comprimidos

**Branch**: `2026-005-workspace-memory-sync-bundles` | **Date**: 2026-05-28 | **Spec**: `.tasks/workspace-memory-sync/TASK-2026-005/spec.md`  
**Input**: Feature specification from `.tasks/workspace-memory-sync/TASK-2026-005/spec.md`

## Summary

Este plan prepara `TASK-2026-005` como una extension de infraestructura sobre
`workspace-memory-sync`, centrada en un bundle comprimido y portable que actua
como artefacto de transporte y auditoria. El cambio agrega workflows dedicados
de exportacion e importacion, scripts Node pequenos y testeables, trazabilidad
de bundle en manifests candidatos/activos, y actualizaciones de registro y
documentacion para que la capacidad quede descubierta en Copilot, Antigravity y
`scaffold/`.

## Technical Context

**Language/Version**: Markdown, JSON y Node.js 20 ESM  
**Primary Dependencies**: ICM CLI existente, `zlib`/`crypto` de Node, sistema
de prompts/skills del repo  
**Storage**: `.specify/memory/versions/**` para manifests/templates y
`.exportsmemories/` como base gobernada para bundles exportados en root, con
mirror en `scaffold/.exportsmemories/`  
**Testing**: `node --test` para export/import/lifecycle bundle-aware, mas
validacion enfocada de markdown/json y parity  
**Target Platform**: workflows agentic-infrastructure sobre macOS, Linux y
Windows 11+  
**Project Type**: infraestructura compartida del repositorio + template instalado
en `scaffold/`  
**Performance Goals**: exportacion deterministicamente comprimida, rechazo rapido
de bundles invalidos y cero ambiguedad entre bundle transportado y memoria
activa  
**Constraints**: no UI-first, no `.resources/`, no dependencias nuevas de
archivado, aprobacion explicita del Owner antes de activar, paridad root/scaffold
y Copilot/Antigravity obligatoria  
**Scale/Scope**: templates bundle-aware, scripts Node, workflows nuevos,
registro/documentacion y pruebas de lifecycle

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design is applied.*

- El cambio preserva la memoria versionada como unica fuente de verdad; el
  bundle solo agrega transporte offline.
- No hay recursos `.resources/` ligados, por lo que no se planifican cambios de
  `relations.json`.
- Las superficies compartidas a mantener en paridad incluyen `.github/`,
  `.agent/`, `.atl/`, `GEMINI.md`, `.specify/`, `.exportsmemories/`,
  `README*` y `scaffold/`.
- La implementacion puede apoyarse en capacidades reales del ICM CLI (`list`,
  `recall`, `memoir export`, `feedback search`) sin asumir una API inexistente
  de exportacion total de memorias.
- La validacion planeada incluye pruebas ejecutables de export/import/lifecycle
  bundle-aware y paridad entre repo vivo y `scaffold/`.

## Project Structure

### Documentation (this feature)

```text
.tasks/workspace-memory-sync/TASK-2026-005/
├── proposal.md
├── requirement.md
├── spec.md
├── design.md
├── tasks.md
└── implementation-plan.md
```

### Source Code & Workflow Surfaces (repository root)

```text
.specify/
└── memory/
    └── versions/

.github/
└── prompts/

.agent/
└── skills/

.atl/

.exportsmemories/

scripts/
└── memory-sync/

scaffold/
├── .specify/memory/
├── .github/
├── .agent/
├── .atl/
└── .exportsmemories/

README.md
README.es.md
GEMINI.md
package.json
```

**Structure Decision**: La feature se implementa enteramente en la raiz del repo
y en sus mirrors instalables. No se requiere una extension de
`apps/agentic-ops-dashboard/` para estabilizar el contrato del bundle.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Introducir un bundle JSON comprimido | Se necesita un artefacto portable, auditable y cross-platform sin nueva infraestructura de red. | Mantener solo sync live deja sin resolver respaldo y transporte offline. |
| Extender manifests con trazabilidad bundle | La version activa/candidata debe recordar el origen portable para auditoria y rollback confiables. | Reusar solo `sourceWorkspace/sourceVersionId` ocultaria si el origen fue live o bundle. |
| Agregar workflows export/import dedicados | El transporte offline requiere preguntas y validaciones distintas al sync live. | Sobrecargar `/sync-workspace-memory` con flags mezclaria dos entry points y debilitaria la claridad operativa. |
| Registrar workflows en skill registry y GEMINI | Los workflows deben ser descubribles en Copilot, Antigravity y la plantilla instalada. | Crear prompts/skills sin registro dejaria la capacidad oculta o inconsistente. |
| Introducir `.exportsmemories/` como base | Los bundles necesitan una ubicacion gobernada, visible y consistente dentro del repo. | Dejar la salida libre al filesystem generaria dispersion y menos auditabilidad operativa. |

## Agent Assignment

- **Supervisor**: ownership de prompts/skills compartidos, registry,
  `GEMINI.md`, estado SDD y paridad root/scaffold.
- **Backend Developer**: scripts Node, schema, templates y metadata bundle-aware.
- **Integration Specialist**: validacion ejecutable de export/import/lifecycle y
  parity de superficies compartidas.
- **Documentation Analyst**: `README.md`, `README.es.md` y
  `.specify/memory/versions/README.md`.

## Dependency Order

1. **Bundle Contract Gate**: definir envelope, template y metadata de bundle.
2. **Export Surface Gate**: materializar `.exportsmemories/` e integrar la ruta
  base al contrato de exportacion.
3. **Export Gate**: generar bundles comprimidos y validables.
4. **Import Gate**: transformar bundles validos en candidatas bundle-aware.
5. **Lifecycle Gate**: preservar activacion y rollback con trazabilidad bundle.
6. **Discovery Gate**: registrar workflows y documentarlos en todo el stack.
7. **Validation Gate**: ejecutar pruebas y parity final.

## Verification Criteria

1. El sistema puede exportar una version explicita a un
  `*.memory-bundle.json.gz` con procedencia, scopes incluidos y scopes omitidos
  dentro de `.exportsmemories/`.
2. Un bundle malformado, incompatible o sin integridad valida es rechazado sin
   crear una candidata ni tocar la version activa.
3. Un bundle valido produce un manifest `candidate` con metadata de transporte
   trazable.
4. Una version activada desde bundle mantiene la version previa como rollback
   inmediato y conserva trazabilidad de origen.
5. Los workflows `/export-memory-bundle` y `/import-memory-bundle` quedan
   descubiertos y alineados entre prompt, skill, registry y GEMINI.
6. Root y `scaffold/` mantienen paridad para prompts, skills, templates,
  package scripts, `.exportsmemories/` y documentacion modificada.

## Execution Notes

- Mantener el bundle como artefacto de transporte; nunca promoverlo a formato
  operativo de memoria activa.
- Favorecer `gzip` sobre formatos de archivado mas pesados para reducir
  complejidad y dependencias.
- Tratar `.exportsmemories/` como la salida base de bundles exportados y evitar
  rutas arbitrarias fuera de esa superficie salvo una decision futura que cambie
  el contrato.
- Mantener `prepare-version-manifest.mjs` como punto de convergencia para sync
  live e importacion desde bundle, evitando un segundo pipeline de activacion.
- Tratar el registro de workflows (`.atl/skill-registry.md`, `GEMINI.md` y
  mirrors) como parte del slice, no como documentacion opcional de ultimo momento.