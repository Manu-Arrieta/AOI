# Proposal — TASK-2026-004

## Summary

Se propone introducir una capacidad transversal de sincronización de memoria
entre workspaces sobre ICM, gobernada por workflow y no como una llamada directa
ad hoc al CLI. Cada importación debe producir una nueva versión operativa de la
memoria del workspace destino, manteniendo trazabilidad del merge, del contexto
aportado por el Owner, de la normalización aplicada y de la decisión explícita
sobre qué se retiene, qué se considera complementario, qué se descarta y cómo se
revierte la activación si la memoria resultante se considera corrupta.

La recomendación es separar dos planos que hoy están mezclados en el pedido: el
versionado del contrato de gobernanza y el versionado del estado operativo de la
memoria. El contrato raíz debe seguir gobernado por
`.specify/memory/constitution.md` y versionarse con semver cuando cambian las
reglas. En paralelo, cada sincronización debe generar un identificador inmutable
de versión de memoria del workspace y una constitución dinámica asociada a esa
versión concreta.

## Current State

- ICM ya es obligatorio en el proyecto para memorias, memoirs, feedback y
  transcripts, pero los accesos actuales siguen pensando en topics canónicos sin
  resolver una versión operativa activa por workspace.
- `apps/agentic-ops-dashboard/` sólo expone snapshot de features, TASKs,
  artefactos y `.resources/` mediante `GET /api/workspace` y `GET /events`.
  No existen hoy entidades de memoria, versiones ni sincronización en su
  read-model.
- La única integración runtime con ICM ya operativa está en
  `server/utils/resource-operations.ts`, donde Nitro valida payloads, actualiza
  una constitución subordinada y persiste el cambio con `icm store`.
- El CLI de ICM permite listar y consultar memorias, feedback y memoirs, pero no
  ofrece un comando nativo para sincronizar memorias entre workspaces ni para
  activar una versión de memoria del workspace. El comando `icm import` está
  orientado a conversaciones externas, no a mergear memoria interna entre
  proyectos.

## Recommended Contract

1. Introducir un `memory version manifest` inmutable bajo
   `.specify/memory/versions/`, con un puntero explícito a la versión activa del
   workspace.
2. Hacer que cada operación de sync resuelva desde el primer momento:
   workspace fuente, versión fuente, scopes a importar (`memories`, `memoir`,
   `feedback`), filtros parciales, contexto del Owner y política de activación.
3. Generar por cada importación una nueva versión operativa del workspace con:
   versión previa, fuentes usadas, criterios de normalización, decisiones de
  `retain`/`complement`/`discard`, timestamp de activación, política de rollback
  y trazabilidad de supersesión.
4. Mantener `.specify/memory/constitution.md` como autoridad de gobernanza y
   añadir una constitución dinámica por versión que capture las reglas activas de
   esa memoria mergeada sin obligar a mutar la constitución raíz en cada sync.
5. Introducir un resolver de versión activa que traduzca alias canónicos como
   `aoi-context` o `aoi-architecture` hacia los topics o memoirs
   concretos de la versión activa, preservando compatibilidad mientras se migra a
   acceso explícito por versión.
6. Implementar una capa de orquestación sobre ICM que use capacidades reales del
   CLI (`topics`, `list`, `memoir export`, `feedback search`, `store`, etc.) para
  construir el plan de importación, ejecutar el merge, persistir la nueva
  versión y restaurar una versión anterior cuando el Owner lo ordene.
7. Exigir que la activación de una versión deje siempre un candidato de retorno
  verificable, con manifiesto íntegro y referencias suficientes para rehacer el
  binding de topics, memoirs y feedback a la versión restaurada.

## Versioning Model

- **Governance Version**: versión semántica de
  `.specify/memory/constitution.md`, sólo cambia cuando cambian reglas,
  restricciones o contratos del workflow.
- **Workspace Memory Version**: identificador inmutable generado en cada sync,
  apunta a los manifiestos y a la constitución dinámica de esa memoria concreta.
- **Rollback Rule**: toda versión activa debe conocer su versión previa
  restaurable y el procedimiento explícito para reactivarla sin merge adicional.
- **Access Rule**: todo flujo debe resolver `workspace + memory version` antes de
  leer o escribir. Los aliases sin versión sólo pueden existir como puente hacia
  la versión activa, nunca como ambigüedad silenciosa.

## Owner-Controlled Sync Flow

- El Owner elige workspace y versión fuente, o explícitamente la versión activa
  de ese workspace si no indica otra.
- El Owner define si quiere importar todo o sólo subconjuntos de memorias,
  memoirs o feedback.
- El Owner puede aportar contexto adicional que ayude a decidir por qué importa,
  qué quiere conservar y qué considera irrelevante.
- El sistema prepara un plan de sync auditable; no debe asumir por sí mismo la
  condensación final de memorias en un proceso de libre albedrío.
- La activación de la nueva versión sólo ocurre tras confirmación explícita.
- Si el Owner detecta corrupción, inconsistencia o regresión de calidad, puede
  ordenar rollback a una versión anterior sin tener que recomponer manualmente el
  estado.

## Impacted Surfaces

- `.specify/memory/constitution.md`
- Nuevos artefactos bajo `.specify/memory/versions/**`
- `.github/prompts/` y `.github/instructions/icm-protocol.instructions.md`
  si el acceso a memoria pasa a depender de un resolver de versión
- `.agent/` y `scaffold/` para mantener dual-sync y paridad del instalador
- Una nueva capa de integración ICM en runtime o tooling compartido para listar,
  exportar, normalizar, activar versiones y restaurar snapshots previos
- `apps/agentic-ops-dashboard/shared/types.ts`, `server/utils/build-workspace-snapshot.ts`,
  `server/api/**` y `app/composables/useWorkspace.ts` sólo si se aprueba una fase
  posterior con UI asistida

## Alternatives Considered

1. Workflow-first, sin UI al inicio.
   Es la forma más alineada con la constitución y el patrón existente de
  gobernanza. Reduce superficie inicial, pero ofrece menos ergonomía para
  inspeccionar diffs, planes de retención y candidatos de rollback.
2. Dashboard-assisted desde la primera iteración.
   Mejora experiencia operativa y visibilidad, pero mete demasiada amplitud en el
   primer corte porque obliga a ampliar snapshot, endpoints, estado cliente y
   validación UI.
3. Wrappers mínimos del CLI sin manifiestos ni constitución dinámica.
   Es el camino más corto, pero incumple el requisito central de resolver versión
   desde el inicio y deja sin contrato la homogeneidad entre memorias, memoirs y
   feedback.

## Risks

- Confundir el versionado de la constitución con el versionado del estado de
  memoria produciría churn innecesario y trazabilidad pobre.
- `icm topics` enumera topics globales sin filtro por workspace, por lo que la
  selección de workspace fuente necesita una capa explícita de resolución o
  manifiestos propios.
- Si no se modela procedencia y decisión de retención por cada bloque importado,
  el merge deja de ser auditable.
- Si el rollback no restaura también el binding de memoirs, feedback y
  constitución dinámica, la reversión sería parcial y engañosa.
- Si el acceso legacy a topics sin versión sigue directo y no mediado por un
  resolver, el sistema volverá ambigua la lectura de memoria tras el primer sync.

## Recommendation

Aprobar una primera iteración centrada en el motor gobernado de sincronización:
manifiestos de versión, constitución dinámica por versión, resolver de memoria
activa, rollback explícito y plan de `retain/complement/discard` controlado por
el Owner. La integración visual en `agentic-ops-dashboard` debería tratarse como
una fase posterior encima de ese contrato, no como el punto de partida.