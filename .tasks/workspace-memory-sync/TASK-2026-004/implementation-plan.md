# Implementation Plan: Sincronización y Versionado de Memorias ICM

**Branch**: `2026-004-workspace-memory-sync` | **Date**: 2026-05-27 | **Spec**: `.tasks/workspace-memory-sync/TASK-2026-004/spec.md`  
**Input**: Feature specification from `.tasks/workspace-memory-sync/TASK-2026-004/spec.md`

## Summary

Este plan prepara `TASK-2026-004` como una mejora de infraestructura compartida,
centrada en gobernanza de memoria versionada, workflows explícitos de sync y
rollback, y utilidades Node pequeñas pero testeables para administrar manifests
y activaciones. La primera iteración evita una UI dedicada y prioriza un motor
workflow-first con artefactos auditables, rollback íntegro y paridad entre el
repo vivo y `scaffold/`.

## Technical Context

**Language/Version**: Markdown, JSON y Node.js 20 ESM  
**Primary Dependencies**: ICM CLI existente, sistema de prompts/instructions del repo, APIs estándar de Node  
**Storage**: `.specify/memory/versions/**` para manifests, puntero activo y snapshots constitucionales  
**Testing**: `node --test` para scripts de resolución/activación/rollback, más validación enfocada de artefactos markdown/json  
**Target Platform**: workflows agentic-infrastructure dentro de VS Code sobre macOS, Linux y Windows 11+  
**Project Type**: infraestructura compartida del repositorio + template instalado en `scaffold/`  
**Performance Goals**: resolución determinista de versión activa, activación/rollback auditables y ausencia de acceso ambiguo a memoria operativa  
**Constraints**: no UI-first, no `.resources/` linkage, aprobación explícita del Owner antes de activar, paridad root/scaffold obligatoria, coherencia Copilot/Antigravity obligatoria  
**Scale/Scope**: constitución de memoria, artefactos versionados, prompts nuevos, actualización del protocolo ICM compartido, scripts Node mínimos y documentación

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design is applied.*

- Dual-sync y parity scope quedan explícitos para `.github/`, `.agent/`,
  `.specify/`, `scaffold/` y documentación compartida.
- Las obligaciones ICM siguen concentradas en el topic
  `sdd-aoi-workspace-memory-sync-TASK-2026-004` y en el memoir
  `aoi-architecture`.
- No se proporcionaron recursos bajo `.resources/`, por lo que no hay cambios
  de `relations.json` planificados.
- El cambio es de workflow compartido y debe preservar compatibilidad
  cross-platform sin rutas absolutas ni dependencias nuevas fuera de Node 20 e
  ICM ya instalado.
- La validación planeada incluye pruebas ejecutables de manifests y rollback,
  además de revisión de paridad entre repo vivo y `scaffold/`.

## Project Structure

### Documentation (this feature)

```text
.tasks/workspace-memory-sync/TASK-2026-004/
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
    ├── constitution.md
    └── versions/

.github/
├── instructions/
└── prompts/

.agent/
└── skills/_shared/

scripts/
└── memory-sync/

scaffold/
├── .specify/memory/
├── .github/
└── .agent/

README.md
README.es.md
package.json
```

**Structure Decision**: La feature se implementa como infraestructura y tooling
de workflow en la raíz del repo, no dentro de `apps/agentic-ops-dashboard/`.
Eso permite resolver y revertir memoria sin depender de un runtime UI y reduce
el alcance de la primera iteración.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Introducir un árbol `.specify/memory/versions/` | El versionado debe quedar materializado como fuente de verdad auditable y restaurable. | Confiar solo en topics ICM bare dejaría ambigua la versión activa y el rollback. |
| Añadir scripts Node mínimos | Se necesita validación ejecutable y mutaciones deterministas sobre manifests y punteros activos. | Resolver todo solo con prompts volvería frágiles la activación y la reversión. |
| Agregar dos workflows explícitos (`sync` y `rollback`) | El Owner necesita operaciones distintas: fusionar con aprobación y revertir sin merge. | Un único prompt multipropósito haría más opacos los controles y la trazabilidad. |
| Reconfigurar el protocolo ICM compartido | El resto de la infraestructura debe dejar de asumir topics bare cuando exista memoria versionada. | Actualizar sólo un prompt local dejaría el sistema globalmente inconsistente. |

## Agent Assignment

- **Supervisor**: ownership de workflows compartidos, constitución, root/scaffold
  parity y mantenimiento del estado SDD.
- **Backend Developer**: scripts Node para resolver versión activa, preparar
  manifests, activar versiones y ejecutar rollback.
- **Integration Specialist**: validación ejecutable de manifests, activación,
  rollback y paridad de superficies compartidas.
- **Documentation Analyst**: README y documentación operativa del nuevo sistema
  de memoria versionada.

## Dependency Order

1. **Governance & Manifest Gate**: definir reglas en constitución y crear el
   árbol `.specify/memory/versions/`.
2. **Resolver Gate**: introducir schema + resolución de versión activa con
   pruebas ejecutables.
3. **Sync Workflow Gate**: crear el workflow de sincronización y la generación
   de manifests candidatos con aprobación explícita.
4. **Activation Gate**: promover manifests aprobados a versión activa y dejar
   trazabilidad de supersesión.
5. **Rollback Gate**: agregar restauración íntegra a una versión anterior.
6. **Protocol & Docs Gate**: actualizar instrucciones compartidas, docs y
   validar parity root/scaffold.

## Verification Criteria

1. El sistema puede resolver la versión activa del workspace desde
   `.specify/memory/versions/active.json` sin ambigüedad.
2. Un sync no puede activarse sin workspace fuente, versión fuente y aprobación
   explícita del Owner.
3. La preparación de un sync produce un manifest candidato con decisiones
   `retain/complement/discard` trazables.
4. Activar una nueva versión actualiza el puntero activo y conserva referencia a
   la versión previa restaurable.
5. Un rollback restaura una versión previa válida sin requerir un merge nuevo ni
   edición manual de artefactos.
6. Prompts, instrucciones y constituciones modificadas permanecen alineados
   entre root y `scaffold/`, y entre Copilot y Antigravity cuando aplica.
7. README y README.es documentan el nuevo contrato de memoria versionada y sus
   workflows asociados.

## Execution Notes

- Mantener los scripts Node pequeños y centrados en validación/mutación de
  artefactos; la inteligencia del plan de sync sigue en el workflow y el Owner.
- Introducir templates claros para manifests y constituciones dinámicas antes de
  automatizar activación o rollback.
- Tratar `active.json` como el único puntero canónico de memoria operativa por
  workspace.
- Evitar cualquier dependencia con el dashboard en esta primera iteración.
- Validar root/scaffold parity como parte del cierre normal, no como tarea de
  último momento.