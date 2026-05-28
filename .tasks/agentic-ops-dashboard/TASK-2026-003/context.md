# Context — TASK-2026-003

- Feature: `agentic-ops-dashboard`
- Title: `Enhance dashboard UX and bilingual language switching`
- Status: `📦 Archivado`
- Created: `2026-05-26`
- Owner: `Supervisor`

## Owner Intent

Elevar el dashboard interno existente para que se sienta visualmente mucho más
atractivo e intuitivo, sin perder claridad operativa. Además, el Owner quiere
que la UI pueda alternar entre inglés y español en ambos sentidos desde el
propio dashboard.

## Initial State

- `apps/agentic-ops-dashboard/` ya existe como runtime Nuxt 4 local con
  snapshot en tiempo real, detalle de TASKs, relaciones explícitas y acciones
  gobernadas sobre `.resources/`.
- La composición principal vive en `app/pages/index.vue`, coordinada por
  `app/composables/useWorkspace.ts`.
- El sistema visual actual está centralizado en `app/assets/styles/main.css`
  con una dirección editorial clara, pero todavía de una sola variante visual.
- La copia visible de la UI está hardcodeada en inglés a través de la página y
  múltiples componentes (`TaskBoard`, `TaskDetailPanel`,
  `TaskRelationsPanel`, `ResourceExplorer`, `ResourceActionDialog`, etc.).
- No existe hoy un servicio de locale, un diccionario de traducciones, ni una
  preferencia persistida de idioma.

## Exploration Focus

- Definir el alcance correcto de un rediseño visual dentro del dashboard actual
  sin reabrir contratos server-side ya estabilizados.
- Evaluar la mejor estrategia de internacionalización para una app interna con
  una sola ruta principal y copy distribuido entre varios componentes.
- Detectar qué superficies deben centralizar labels, microcopy, estados y
  llamadas a la acción para que el cambio de idioma sea consistente.
- Mantener intactos el read-model, el SSE y la gobernanza sobre `.resources/`
  mientras la mejora se concentra en UX y presentación.

## Exploration Outcome

- La arquitectura actual permite resolver este pedido íntegramente dentro del
  runtime Nuxt existente; no hace falta un cambio de backend ni de modelo de
  datos para la primera iteración visual e idiomática.
- `useWorkspace.ts` ya concentra el estado operativo y los endpoints del
  dashboard, por lo que el nuevo slice debe traducir y reorganizar la capa de
  presentación, no redefinir la lógica de negocio.
- La ausencia total de i18n sugiere introducir una capa de locale explícita y
  pequeña en cliente antes que adoptar de entrada una solución de rutas
  localizadas más pesada.
- El cambio visual debe priorizar jerarquía, escaneabilidad, señal operativa,
  feedback claro y mejor lectura en desktop y mobile sin convertir la UI en un
  tema genérico.

## Proposal Outcome

- `proposal.md` fue redactado con una recomendación de rediseño visual dentro
  del runtime actual y una estrategia inicial de bilinguismo EN/ES centrada en
  diccionarios de UI y preferencia local de idioma.
- `TASK-2026-003` quedó en estado `📋 Propuesto` a la espera de aprobación del
  Owner para avanzar a `/sdd-ff`.

## Approval

- Proposal approved by Owner on `2026-05-26`.
- Handoff initiated to `@functional-analyst` for `requirement.md`.
- `TASK-2026-003` moved to `📐 En Análisis`.

## Requirements Outcome

- `requirement.md` was created for the UX and bilingual enhancement slice.
- The functional scope centers on a more attractive and intuitive dashboard UI,
  an explicit EN/ES language switch, persistence of the selected language, and
  preservation of operational clarity around real-time status and governed
  actions.
- The task is ready to continue with `/sdd-ff TASK-2026-003`.

## Planning Outcome

- `spec.md`, `design.md`, `tasks.md`, and `implementation-plan.md` were created
  during `/sdd-ff`.
- The plan keeps the existing dashboard runtime and server contracts intact,
  introduces a lightweight client-side locale layer for EN/ES UI shell copy,
  and refreshes the visual hierarchy of the current dashboard surfaces.
- Validation will focus on locale switching, language persistence, layout
  resilience for longer translated copy, and non-regression of realtime and
  governed resource behavior.
- `TASK-2026-003` is ready for `/sdd-apply` once the Owner approves the plan.

## Implementation Outcome

- The dashboard shell now uses a centralized EN/ES dictionary plus
  `useLocale.ts` to translate structural copy across the landing shell, task
  board, task detail, relations panel, governed resource explorer, and governed
  action dialogs in both the live runtime and the `scaffold/` mirror.
- The UX refresh shipped together with realtime-aware task highlighting and lane
  transitions so workspace updates stay context-preserving instead of reading as
  a full-page refresh.
- Locale persistence now combines local preference storage with a Nuxt bootstrap
  plugin that synchronizes the selected language into a cookie, preventing
  hydration mismatches on reload while keeping the runtime payloads and artifact
  previews source-authored.
- Focused UI coverage was extended for locale persistence, translated shell
  copy, raw-content exemption, task-board behavior, task-change state, and
  governed resource non-regression.

## Verification Outcome

- `verify-report.md` was created with `PASS` after confirming all spec
  requirements against the implemented runtime surfaces.
- `./node_modules/.bin/vitest run` passed in
  `apps/agentic-ops-dashboard/` with 12 test files and 22 tests green.
- `rtk test pnpm run prepare:dashboard` completed successfully after the locale
  bootstrap plugin was added.
- Browser smoke validated the visible language switch, persistence in both
  `localStorage` and `agentic-ops-dashboard-locale=es` cookie, retention of
  task identifiers such as `TASK-2026-003`, and reload without hydration
  mismatch warnings.

## Archive Complete

- `/sdd-archive` produced `functional-docs.md` and `archive-report.md` for
  long-term closure of the UX and bilingual dashboard slice.
- The task memories under `sdd-aoi-agentic-ops-dashboard-TASK-2026-003`
  were consolidated in ICM and the archive transcript session was recorded.
- Feedback review captured two task-specific corrections: one around unstable
  `UNavigationMenu` macro usage in `pages/index.vue` and one from the discarded
  Figma MCP exploration path.
- `aoi-architecture` memoir export confirmed the preserved dashboard
  concepts for the locale layer, operational shell, runtime, and realtime event
  stream.
- `TASK-2026-003` was moved to `📦 Archivado` on `2026-05-27`.