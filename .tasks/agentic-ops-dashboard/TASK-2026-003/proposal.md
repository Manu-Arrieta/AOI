# Proposal — TASK-2026-003

## Summary

Se propone una segunda iteración del `agentic-ops-dashboard` enfocada en dos
frentes complementarios: elevar la calidad visual y de uso del dashboard para
que se sienta más intencional, legible e intuitivo, e incorporar un cambio de
idioma explícito entre inglés y español desde la propia UI. La recomendación es
mantener todo dentro del runtime Nuxt 4 existente y tratar este slice como una
evolución de presentación y experiencia, no como una reescritura del modelo de
datos ni del canal en tiempo real.

## Current State

- El dashboard ya ofrece snapshot en tiempo real, detalle de TASKs, relaciones
  explícitas y operaciones gobernadas sobre `.resources/`.
- La orquestación de estado está concentrada en `app/composables/useWorkspace.ts`.
- La shell visual actual vive en `app/pages/index.vue` y `app/assets/styles/main.css`.
- La UI tiene copy hardcodeado en inglés en múltiples componentes y formularios.
- No existe hoy una capa de locale, un catálogo de mensajes ni una preferencia
  persistida de idioma.

## Recommended Contract

1. Mantener la arquitectura actual del dashboard y encapsular este cambio como
   una mejora frontend dentro de `apps/agentic-ops-dashboard/`.
2. Introducir una capa explícita de idioma para `en` y `es`, con un toggle
   visible en la shell principal y preferencia persistida localmente.
3. Centralizar labels, microcopy, empty states, mensajes de error, texto de
   botones y títulos de paneles en un catálogo de UI en lugar de dejarlos
   dispersos por componente.
4. Preservar respuestas server-side y payloads como datos neutrales al idioma;
   la traducción debe vivir en la capa de presentación para no duplicar lógica
   en Nitro.
5. Reforzar jerarquía visual, ritmo de lectura y escaneabilidad con un rediseño
   intencional del hero, paneles, estados, acciones y densidad informativa.
6. Mantener intactos el read-model, el SSE, el detalle de artefactos y las
   operaciones gobernadas sobre `.resources/`, salvo ajustes necesarios para
   mejorar rotulación y feedback visual.

## UX Direction

- La nueva UI debe sentirse más deliberada y operativa, con mejor contraste de
  prioridades entre overview, foco actual y acciones disponibles.
- El dashboard debe reducir fricción cognitiva: métricas más claras, mejor
  agrupación, estados más legibles, feedback contextual más visible y textos más
  cortos cuando el usuario está operando.
- El cambio de idioma debe ser inmediato y predecible, sin recargar la página y
  sin ambigüedad sobre cuál es el idioma activo.
- La dirección visual debe mantener personalidad propia en lugar de caer en un
  dashboard genérico o puramente utilitario.

## Impacted Surfaces

- `apps/agentic-ops-dashboard/app/pages/index.vue`
- `apps/agentic-ops-dashboard/app/components/*.vue`
- `apps/agentic-ops-dashboard/app/assets/styles/main.css`
- Nuevas utilidades o composables para locale, diccionarios y copy centralizado
- Tests UI para asegurar cambio de idioma y consistencia de labels críticos
- `scaffold/apps/agentic-ops-dashboard/**` para mantener paridad del runtime

## Alternatives Considered

1. `@nuxtjs/i18n` desde esta iteración.
   Escala mejor hacia rutas localizadas, SEO y mayor volumen de contenido, pero
   hoy agrega complejidad innecesaria para una app interna de una sola vista con
   copy relativamente acotado.
2. Capa ligera de locale con diccionarios locales y composable dedicado.
   Es la mejor relación valor/esfuerzo para este corte: deja el cambio de idioma
   explícito, centraliza la copia y evita sobreconfigurar el runtime.
3. Mantener copy hardcodeado y duplicar condicionales por componente.
   Tiene esfuerzo inicial bajo, pero degrada rápido la mantenibilidad y aumenta
   el riesgo de inconsistencias entre inglés y español.

## Risks

- Si no se centraliza el copy, el bilinguismo se va a dispersar y será caro de
  mantener.
- Algunos labels de estado hoy provienen de superficies de dominio existentes;
  habrá que decidir en planificación qué textos se muestran raw y cuáles se
  mapean a una presentación traducida.
- Un rediseño visual sin criterio de jerarquía puede volver el dashboard más
  vistoso pero menos operativo.
- Si no se preserva la paridad con `scaffold/`, el runtime instalado y el runtime
  del repo volverán a divergir.

## Recommendation

Aprobar esta propuesta y avanzar a `/sdd-ff TASK-2026-003` para definir el
alcance funcional exacto del rediseño visual, el mecanismo de locale EN/ES, la
persistencia de preferencia de idioma, el inventario de textos a centralizar y
la estrategia de validación para asegurar una UX más intuitiva sin afectar el
comportamiento operativo ya implementado.