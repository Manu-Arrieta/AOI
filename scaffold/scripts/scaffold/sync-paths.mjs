/**
 * scripts/scaffold/sync-paths.mjs
 *
 * QUÉ gobierna AOI, como dato. El CÓMO se verifica vive en
 * `validate-scaffold-parity.mjs`, que re-exporta esta lista.
 *
 * Se separó cuando `validate-scaffold-parity.mjs` llegó a 326 líneas contra el
 * límite de 300 del Invariante 5 y hubo que agregarle entradas: el corte es
 * real —una lista de rutas y un algoritmo de comparación byte a byte son dos
 * cosas— y además la responden más módulos que la compuerta de paridad.
 * `governed-paths.mjs` la usa para decidir qué código es de AOI en una
 * instalación, donde `scaffold/` ya no existe.
 */

export const DEFAULT_SYNC_PATHS = [
  '.github/instructions',
  '.github/agents',
  '.github/prompts',
  'scripts/subagent-context',
  'scripts/sandbox',
  'scripts/scaffold',
  // Se envia a toda instalacion via scaffold/ pero no estaba gobernado: raiz y
  // espejo podian derivar sin que nada fallara, que es la misma forma del
  // protocolo duplicado que esta auditoria encontro divergido.
  'scripts/code-lens',
  'scripts/memory-sync',
  'scripts/sdd-lifecycle',
  'scripts/mcp-gateway',
  'scripts/spatiotemporal-runtime',
  'scripts/multi-harness',
  'scripts/aoi-doctor.mjs',
  'scripts/aoi-doctor.test.mjs',
  // The profile resolver is imported by dashboard-command.mjs. It must travel
  // with that command or a Core install would only discover the missing module
  // when it tries to run its global test gate.
  'scripts/installation-profiles.mjs',
  'scripts/installation-profiles.test.mjs',
  // `doctor-checks.mjs` se enviaba a toda instalación vía scaffold/ pero no
  // estaba gobernado, y eso ya cobró su precio: se le agregó un export que
  // `aoi-doctor.mjs` —gobernado— importa, y la copia del scaffold quedó vieja.
  // Root y espejo derivaron sin que nada fallara acá, y el que rompía era la
  // instalación, lejos de la causa. Es la misma forma del protocolo duplicado
  // que esta lista ya corrigió una vez para scripts/{code-lens,memory-sync,...}.
  'scripts/doctor-checks.mjs',
  // Los tests del doctor viajan en el scaffold a TODA instalación —el área
  // `scripts` los corre— pero no estaban gobernados, que es la tercera vez que
  // esta lista paga la misma forma después de `doctor-checks.mjs` y
  // `archify-checks.mjs`. Medido el 2026-09-18 comparando raíz contra espejo:
  // `doctor-checks.test.mjs` había derivado 213 líneas y `doctor-state-checks`
  // otro tanto, y la copia vieja que corre en una instalación afirmaba que ICM
  // es la ÚNICA herramienta obligatoria — exactamente la política que el Owner
  // derogó. `pnpm test` salía 1 en todo workspace instalado por un test que el
  // repositorio de desarrollo ya había corregido y que nunca llegó.
  'scripts/doctor-checks.test.mjs',
  'scripts/doctor-state-checks.test.mjs',
  'scripts/doctor-verdict-rules.test.mjs',
  'scripts/doctor-verdicts.test.mjs',
  // Mismo caso que `doctor-checks.mjs`: se envía a toda instalación vía
  // scaffold/ y una fase lo invoca, así que la copia del espejo tiene que ser
  // verificada o root y espejo derivan sin que nada falle acá.
  'scripts/archify-path.mjs',
  'scripts/archify-path.test.mjs',
  // `doctor-checks.mjs` lo importa y re-exporta, y el doctor de una instalación
  // resuelve por acá la ruta del renderizador. Sin gobernar, la copia del espejo
  // quedaría vieja y `aoi:doctor` rompería lejos de la causa — el mismo
  // accidente que ya pasó dos veces con `doctor-checks.mjs`.
  'scripts/archify-checks.mjs',
  // Ambos guards corren en el doctor de CADA instalación —y el de facts sólo
  // sirve ahí—: un espejo viejo rompe lejos de la causa, como `doctor-checks.mjs`.
  'scripts/memoir-naming-guard.mjs',
  'scripts/memoir-naming-guard.test.mjs',
  'scripts/facts-consistency-guard.mjs',
  'scripts/facts-consistency-guard.test.mjs',
  'LICENSE',
  'package.json',
  // `pnpm-workspace.yaml` used to be governed here, and it must not be: the
  // root manifest existed only to declare `packages: [aoi_apps/*]` for the
  // dashboard, so governing it shipped it. Installing AOI into a real pnpm
  // monorepo then replaced that repo's workspace manifest — every package in
  // it — with AOI's, and the base project's own packages became invisible to
  // its package manager. The dashboard now declares its own workspace under
  // `aoi_apps/`, which is the path governed below.
  'aoi_apps/pnpm-workspace.yaml',
  // Un formateador de editor sin config fija reescribe el repo a su gusto: el
  // 2026-09-12 eso rompió la paridad y el SRP de golpe. Si la config no viaja a
  // la instalación, el mismo accidente es posible ahí y nadie lo ve hasta que
  // las dos copias divergen.
  '.prettierrc',
  '.prettierignore',
  // Codebase Memory reads this independently of Git. Its exclusion boundary
  // must travel with the workspace and stay mirrored, otherwise a reinstall
  // can make the graph silently include the scaffold duplicate or dashboard.
  '.cbmignore',
  '.resources/constitution.md',
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.clinerules',
  '.cursor/rules',
  '.agents/rules',
  '.agents/skills',
  '.github/scripts',
  '.github/skills',
  // The guard is copied into the target twice — by rsync from the scaffold
  // and by an explicit `cp` from the repository root — so an ungoverned
  // mirror lets the two drift and the winner is whichever ran last.
  '.githooks',
  'scripts/aoi-headroom-wrap.sh',
  'scripts/aoi-headroom-wrap.ps1',
  'aoi_apps/agentic-ops-dashboard/app',
  'aoi_apps/agentic-ops-dashboard/server',
  'aoi_apps/agentic-ops-dashboard/shared',
  'aoi_apps/agentic-ops-dashboard/test',
  'aoi_apps/agentic-ops-dashboard/tsconfig.json',
  'aoi_apps/agentic-ops-dashboard/.cbmignore',
]
