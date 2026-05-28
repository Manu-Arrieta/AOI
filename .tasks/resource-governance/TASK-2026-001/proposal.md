# Proposal — TASK-2026-001

## Summary

Se propone introducir un subsistema gobernado de recursos internos para la
infraestructura agéntica. La opción recomendada es crear una carpeta raíz
`.resources/` con una estructura mínima instalada por defecto, mantener el uso
de recursos como una vinculación explícita y optativa durante la construcción de
una tarea, y crear workflows administrativos específicos para altas,
movimientos y bajas, siempre con sincronización de constitución, scaffold,
registries e ICM.

## Recommended Contract

```text
.resources/
├── constitution.md
├── userstories/
└── workflows/
```

1. `.resources/` será parte de la estructura base instalada por AOI.
2. `.resources/constitution.md` definirá la estructura interna permitida y sus
   reglas operativas.
3. `userstories/` almacenará historias de usuario reutilizables como insumo
  opcional para la construcción de tareas.
4. `workflows/` almacenará definiciones de interacción entre componentes dentro
  de una misma historia de usuario o entre múltiples historias.
5. Los recursos de `.resources/` solo se vincularán cuando el usuario lo pida
  explícitamente durante la construcción de una tarea; no se consultarán por
  defecto.
6. `.specify/memory/constitution.md` seguirá siendo la autoridad superior del
  proyecto y deberá enmendarse para delegar formalmente el contrato estructural
  de `.resources/`.
7. La gestión estructural de `.resources/` se dividirá en workflows
  administrativos separados: `/new-resource-folder`, `/move-resource-folder` y
  `/delete-resource-folder`.
8. Cada workflow deberá actualizar la constitución local de recursos, cualquier
  referencia necesaria en la constitución raíz y el contexto persistido en ICM.

## Why This Fits The Current System

- Respeta la constitución existente al reconocer que cualquier constitución
  adicional requiere una enmienda explícita en la fuente de verdad actual.
- Reutiliza el patrón ya existente de workflows que crean estructuras gestionadas
  y persisten su estado, como ocurre con `/sandbox-new`.
- Mantiene la filosofía actual del proyecto: cambios de workflow gobernados,
  dual-sync entre herramientas y persistencia en ICM.
- Separa conocimiento reutilizable (`.resources/`) de artefactos efímeros o
  task-locales (`.tasks/`).
- Mantiene la construcción de tareas como punto de entrada autónomo: los
  recursos se enlazan cuando aportan contexto, pero no condicionan la
  interacción base.
- Da un propósito funcional claro a `workflows/` como recurso de diseño entre
  user stories, separado de los comandos administrativos del sistema.

## Impacted Surfaces

- `.specify/memory/constitution.md`
- `.resources/constitution.md` como nuevo contrato subordinado
- Superficies de construcción de tareas que permitan vincular recursos solo a
  pedido del usuario
- Nuevos workflows `/new-resource-folder`, `/move-resource-folder` y
  `/delete-resource-folder` en Copilot y Antigravity
- `.atl/skill-registry.md` y su mirror en `scaffold/`
- `README.md`, `README.es.md`, `GEMINI.md`, setup y teardown si la estructura se
  instala por defecto
- ICM topics para estado y descubrimiento de recursos

## Alternatives Considered

1. Crear una carpeta libre sin constitución ni workflow dedicado.
   Esto reduce esfuerzo inicial, pero rompe la gobernanza del proyecto y genera
   drift operativo.
2. Guardar estos recursos dentro de `.tasks/`.
   Reutiliza estructura existente, pero mezcla insumos reutilizables con
   entregables de tareas y dificulta su uso transversal.

## Risks

- La constitución actual considera drift cualquier otra ruta de constitución;
  el feature exige resolver esa contradicción de forma deliberada.
- Los nuevos workflows tocan superficies compartidas en root y `scaffold/`, por
  lo que el riesgo de desincronización es alto si no se tratan como cambio dual.
- Si la construcción de tareas quedara acoplada a `.resources/`, degradaría la
  experiencia de uso directo con el agente; el diseño debe evitar ese
  acoplamiento.
- Si `workflows/` no se distingue semánticamente de los comandos
  administrativos, el modelo puede quedar ambiguo para el Owner y para futuros
  agentes.

## Recommendation

Aprobar esta propuesta y avanzar a `/sdd-ff` para diseñar el modelo de
gobernanza entre constitución raíz y constitución de recursos, el contrato de
los workflows `/new-resource-folder`, `/move-resource-folder` y
`/delete-resource-folder`, la semántica de `userstories/` y `workflows/` como
recursos opcionales durante la construcción de tareas, los topics de ICM para
estado estructural y el plan de sincronización root/scaffold.