# Proposal — TASK-2026-002

## Summary

Se propone añadir un proyecto interno `apps/agentic-ops-dashboard/` como
dashboard web local y en tiempo real para el workspace. La opción recomendada,
tras reevaluar el stack, es usar la última versión estable de `Nuxt` como app
full-stack local: la UI vive en Nuxt, `Nitro` resuelve las rutas server-side,
la observación del filesystem sigue a cargo de `chokidar` y el transporte en
tiempo real puede resolverse dentro del mismo proyecto con `WebSocket` o `SSE`.
Esto evita montar un servicio backend separado, aunque no elimina la necesidad
de código server-side para leer el workspace, observar cambios y ejecutar
acciones gobernadas. El read-model inicial debe tomar `.tasks/registry.md`, los
artefactos de cada TASK y `.resources/` como fuentes de verdad, e introducir una
pieza explícita de relación por TASK para vincular user stories y workflows.

## Recommended Contract

```text
apps/
└── agentic-ops-dashboard/
    ├── app/ or pages/         # vistas y rutas del dashboard
    ├── components/            # componentes de UI
    ├── server/api/            # snapshot y acciones gobernadas
    ├── server/routes/         # SSE o WebSocket para realtime
    ├── server/utils/          # indexación, watchers y acceso al workspace
    └── shared/                # tipos, esquemas y utilidades comunes
```

1. El repositorio incorporará un proyecto interno nuevo en `apps/` para no mezclar
   runtime de producto con prompts, skills y scaffolding.
2. La capa server-side de Nuxt indexará como mínimo estas fuentes de verdad:
   `.tasks/registry.md`, `.tasks/{feature}/TASK-YYYY-NNN/*.md`, `.resources/**/*`
   y `.atl/skill-registry.md` para metadatos de workflows disponibles.
3. El dashboard emitirá eventos en tiempo real sobre snapshot inicial, cambios de
   TASK, cambios de artefactos y cambios en recursos del workspace.
4. Las relaciones TASK ↔ resource no se inferirán desde texto libre: cada TASK
   deberá contar con una pieza canónica y machine-readable de relaciones
   (`relations.json` u otro sidecar equivalente aprobado en planificación).
5. La primera iteración del dashboard será observacional para `.tasks/` y tendrá
   interacción gobernada solo sobre `.resources/`, delegando cambios a rutas
   server-side de Nuxt en lugar de escribir directamente desde el navegador.
6. La UI inicial deberá cubrir al menos overview general, lista o tablero de
   TASKs, panel de artefactos por tarea, explorador de `.resources/` y vista de
   relaciones entre TASKs, user stories y workflows.

## Recommended Frameworks

- Stack principal: `Nuxt 4.4.6` con `TypeScript` para unificar frontend, rutas
  server-side y runtime local en un solo proyecto.
- UI: ecosistema Vue/Nuxt nativo; si en planificación priorizamos velocidad de
  armado, `Nuxt UI` puede ser una base razonable, siempre cuidando no caer en un
  dashboard genérico.
- Backend embebido: `Nitro` y `server/api` para exponer snapshot del workspace,
  lectura de artefactos y acciones gobernadas sobre `.resources/`.
- Realtime: `WebSocket` en Nitro si queremos dejar lista la interacción
  bidireccional desde el inicio; `SSE` es una alternativa más simple si el
  primer corte es estrictamente server-to-client.
- Observación del workspace: `chokidar` para file watching sobre `.tasks/` y
  `.resources/`.
- Parsing e indexación: `remark` o `mdast` para Markdown y `gray-matter` solo si
  en planificación se decide introducir frontmatter en nuevos artefactos.
- Gestión de datos en cliente: `useFetch`, `useAsyncData` y un store ligero para
  estado de UI y sesión del dashboard; no hace falta sumar una capa pesada al
  MVP.
- Monorepo/runtime: `pnpm` como workspace manager si se formaliza `apps/` como
  contenedor de proyectos internos futuros.

## Why This Fits The Current System

- El repositorio actual es file-first y ya tiene fuentes de verdad claras para
  TASKs y recursos; Nuxt puede indexarlas sin forzar una migración de artefactos
  existentes.
- Si la prioridad es reducir cantidad de piezas, Nuxt resuelve mejor que una SPA
  más un servidor separado porque centraliza UI, rutas server-side y transporte
  realtime dentro del mismo proyecto.
- El uso de `WebSocket` o `SSE` dentro de Nitro evita abrir un servicio aparte,
  pero mantiene una frontera técnica sana entre navegador y filesystem.
- Las mutaciones iniciales sobre `.resources/` ya tienen un marco de gobernanza
  reutilizable, lo que reduce riesgo al abrir interacción desde la UI.
- Un sidecar de relaciones por TASK evita depender de inferencias frágiles sobre
  texto libre y hace que la visualización de user stories/workflows sea fiable.

## Impacted Surfaces

- Nuevo proyecto interno bajo `apps/agentic-ops-dashboard/`
- `.tasks/registry.md` y el árbol de artefactos por TASK como fuentes de lectura
- Flujos SDD que en el futuro deban crear o actualizar relaciones canónicas por
  TASK cuando existan vínculos con `.resources/`
- `.resources/` como explorador navegable y primera superficie interactiva
- Documentación y setup del repositorio cuando el proyecto interno pase a ser
  parte formal de la infraestructura instalada

## Alternatives Considered

1. `React + Vite + Fastify`.
  Da fronteras muy explícitas y desacopla mejor UI de runtime local, pero suma
  una pieza operativa más y no aporta un beneficio decisivo en este caso si el
  dashboard va a vivir embebido en el workspace.
2. SPA estática con polling periódico.
   Reduce el esfuerzo inicial, pero no cumple bien el requisito de tiempo real y
   escala peor hacia interacción directa.
3. `Tauri` o `Electron` desde el primer corte.
   Ofrecen integración más profunda con el sistema operativo, pero elevan mucho
   la complejidad de empaquetado para una necesidad que hoy sigue siendo web y
   local al workspace.

## Risks

- Si no se define una representación canónica de relaciones por TASK, el
  dashboard no podrá mostrar de forma confiable vínculos con user stories y
  workflows.
- El parser del read-model será sensible al drift de formatos si los artefactos
  Markdown cambian sin contrato explícito.
- Abrir escritura desde la UI sin encapsularla en rutas server-side gobernadas
  rompería el modelo actual del repositorio.
- Nuxt evita un servicio backend separado, pero no evita tener código server-
  side, watchers, validaciones y control de concurrencia dentro del mismo
  proyecto.
- Introducir el primer proyecto Node del repo obligará a decidir package manager,
  scripts de setup y expectativas cross-platform.

## Recommendation

Aprobar esta propuesta y avanzar a `/sdd-ff TASK-2026-002` para cerrar la forma
exacta del proyecto interno en Nuxt, el contrato de eventos realtime, el esquema
del read-model, la representación canónica de relaciones por TASK y el alcance
de la primera iteración observacional con interacción gobernada sobre
`.resources/`.