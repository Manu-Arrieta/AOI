# Proposal — TASK-2026-005

## Summary

Se propone extender `workspace-memory-sync` con un formato portátil de
exportación e importación comprimida para versiones de memoria gobernadas. En
lugar de depender exclusivamente de un workspace fuente accesible en vivo, el
Owner podrá exportar una versión concreta a un bundle auditable y luego
importarlo en otro workspace o en otro momento, manteniendo el mismo gate de
`candidate -> review -> activate -> rollback` que ya ordena la sync versionada.

## Current State

- El lifecycle version-aware ya existe bajo `.specify/memory/versions/**` con
  manifests, constituciones dinámicas, versión activa y rollback explícito.
- `/sync-workspace-memory` hoy depende de `sourceWorkspace` + `sourceVersionId`
  y prepara un manifiesto candidato contra una fuente viva.
- Ningún prompt, script o esquema actual define un paquete portable con scopes
  incluidos, metadatos de procedencia, validación de integridad o compatibilidad
  para transporte offline.
- El dashboard no expone aún entidades de memoria ni bundles; la superficie
  vigente para este dominio sigue siendo workflow-first.

## Recommended Contract

1. Introducir un `memory bundle` que represente una snapshot portable de una
   versión de memoria de workspace, opcionalmente filtrada por scopes
   (`memories`, `memoir`, `feedback`) y empaquetada en formato comprimido.
2. Exigir que el bundle cargue metadatos explícitos de procedencia y validación:
   workspace origen, versionId origen, timestamp de exportación, scopes
   incluidos, versión de formato, compatibilidad de gobernanza y marcas de
   integridad.
3. Separar el flujo en dos operaciones gobernadas y complementarias:
   `export`, que genera el bundle portable desde un workspace + versión
   explícitos, e `import`, que valida el bundle y lo transforma en una nueva
   versión candidata del workspace destino.
4. Mantener la importación alineada con el lifecycle existente: candidate
   manifest, review del Owner, activación opcional y rollback explícito.
5. Preservar el control del Owner sobre las decisiones de `retain`,
   `complement` y `discard` durante la importación, aunque la fuente llegue como
   bundle en vez de consulta viva a otro workspace.
6. Tratar el bundle comprimido como artefacto de transporte y auditoría, no como
   el formato operativo de memoria activa; el estado activo debe seguir viviendo
   en manifests versionados y constituciones dinámicas.
7. Hacer que la sync directa entre workspaces y la importación desde bundle sean
   dos entradas a un mismo modelo de gobernanza, no dos sistemas paralelos.

## Portable Bundle Scope

- Debe soportar exportación completa y parcial por scopes, declarando de forma
  explícita qué quedó afuera.
- Debe incluir sólo memoria transferible y metadatos suficientes para validarla,
  sin arrastrar ruido operativo del workspace de origen.
- Debe rechazar importaciones cuando falte procedencia, compatibilidad o un
  descriptor verificable del contenido comprimido.
- Debe dejar trazabilidad clara entre bundle importado, versión candidata
  generada y target de rollback resultante.

## Likely Impacted Areas

- Nuevos workflows o extensiones de prompts bajo `.github/prompts/` para
  exportación e importación de bundles comprimidos.
- Nuevos scripts y/o esquemas bajo `scripts/memory-sync/` para serialización,
  compresión, validación e ingestión del bundle.
- Templates o metadatos adicionales bajo `.specify/memory/versions/` para ligar
  la versión importada con el bundle fuente.
- Documentación operativa en `README.md`, `README.es.md` y `scaffold/` para
  mantener paridad del contrato.

## Alternatives Considered

1. Extender `/sync-workspace-memory` con un flag opcional para compresión.
   Es el camino más corto, pero mezcla exportación e importación en una sola
   interfaz y debilita los límites de validación.
2. Crear workflows específicos de export/import sobre el lifecycle versionado
   actual.
   Tiene mejor auditabilidad y deja más clara la frontera entre transporte e
   ingestión, aunque introduce un nuevo artefacto portable.
3. Llevar el primer corte al dashboard.
   Mejoraría ergonomía operativa, pero amplía alcance antes de estabilizar el
   contrato de bundle y sus reglas de validación.

## Risks

- Si el bundle no incluye procedencia o compatibilidad suficiente, la
  importación deja de ser auditable y segura.
- Si el bundle comprimido pasa a reemplazar el formato operativo de memoria
  activa, se fragmenta el modelo actual de versiones y rollback.
- Si la importación desde bundle salta el gate de candidate/review/activate,
  la feature regresa a un flujo ad hoc y pierde gobernanza.
- Si las exportaciones parciales no declaran exclusiones con claridad, el Owner
  puede asumir que importó una versión completa cuando en realidad recibió un
  subconjunto.

## Recommendation

Aprobar una primera iteración centrada en el contrato portable: exportar un
bundle comprimido desde un workspace + versión explícitos, importarlo como una
versión candidata gobernada y reutilizar activación y rollback del modelo ya
existente. La superficie visual del dashboard debería tratarse como una fase
posterior, una vez que el transporte, la integridad y la compatibilidad del
bundle queden estables.