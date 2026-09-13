#!/usr/bin/env node
/**
 * scripts/scaffold/mutation-ratchet.mjs
 *
 * Holds each area's mutation score against the day it was first measured.
 *
 * `pnpm test` answers "does the code still do what the tests say". This
 * answers the question underneath it: "do the tests still say anything". A
 * suite can keep passing while its assertions rot into tautologies, and
 * nothing in a green run distinguishes the two.
 *
 * The probe is slow — it runs an area's suite once per mutant — so this is a
 * DELIBERATE check (`pnpm aoi:mutation`), not part of the default chain. Its
 * cost is minutes of CPU and zero inference tokens.
 *
 * The numbers below are the measurement of 2026-09-10 and are a floor: a
 * score may rise, never fall. They are low on purpose rather than aspiration
 * — recording where the suites actually stand is what makes the next
 * improvement visible.
 */

import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { probe } from './mutation-probe.mjs'

/**
 * Floor score per area, in percent of mutants killed.
 *
 * The survivors behind these numbers cluster in one shape across every area:
 * a tested library beside an untested `main()`. The CLI is what the SDD cycle
 * actually invokes, so that is where the next rise should come from — the
 * verifier's exit-code line was the first one repaid.
 */
export const MUTATION_FLOOR = {
  // 68 → 69 en la cuarta pasada. No es que el área haya mejorado sola: la
  // lente adversarial midió que `isTurnSuperseded` tumbaba el diagnóstico de un
  // archivo con la corrida de OTRO, y que dos turnos sin `id` no se tumbaban
  // nunca. Los casos que fijan las dos correcciones matan más mutantes.
  'scripts/subagent-context': 69,
  // 86 → 88. Los casos de contención de `assertSandboxPath` —barra invertida,
  // `..` que vuelve adentro, nombre de sandbox que no es un segmento— matan
  // mutantes del guard que antes sobrevivían porque ningún test le daba la
  // entrada que el guard existe para atrapar.
  'scripts/sandbox': 88,
  // 52 → 53 → 93 → **91**, y la última corrección es la más incómoda de las tres.
  //
  // El salto grande no viene de más tests: viene de mirar POR QUÉ sobrevivían. 60
  // de los 78 eran de operador booleano —`and→or`, `gt→gte`, `or→and`— en guardias
  // que se ejercitaban SÓLO con entrada válida, y cada una deja sobrevivir
  // exactamente dos mutantes. Ver A.23.
  //
  // Pero 93 NO ERA REPRODUCIBLE, y se midió así por accidente. Cuatro mutantes
  // —`resolve-active-version.mjs:110` y `rollback-version.mjs:51`— morían por el
  // estado del `icm` REAL de la máquina donde se medía: sus tests corren el CLI,
  // el CLI filtra por lo que haya en la base, y con otros datos las mutaciones
  // sobrevivían. Al poner el `icm` de mentira que el CI necesita (A.24) los dos
  // entornos convergen: **91 en los dos, con los supervivientes idénticos**.
  //
  // O sea que el trinquete tenía un piso que el CI no podía alcanzar, por la misma
  // causa que dejó el CI rojo dos días: una dependencia del entorno que se veía en
  // un solo lugar. El piso es el valor REPRODUCIDO, no el mejor visto.
  'scripts/memory-sync': 91,
  // Los 11 que quedan son el manejo de fallas del CLI de ICM (`ok`, `error.code`,
  // `allowFailure`): necesitan un `icm` que falle a demanda. Declarado, no
  // perseguido.
  // 67 → 68. Los casos de la guardia de ancho de `buildArchiveClosure` (paso
  // 7.4) matan mutantes que antes sobrevían. Los mutantes del área subieron de
  // 229 a 249 por el código nuevo, y el score subió igual.
  'scripts/sdd-lifecycle': 68,
  // Shell. The installer machinery is where the most destructive defects of
  // the audit lived, so leaving it unmeasured left the worst code in the
  // project outside the only check that asks whether its tests bind.
  'scripts/conf': 62,
  // `scripts` (la raíz) es aoi-doctor más doctor-checks. Midió 15% cuando su
  // veredicto no tenía un solo test, y 81% una vez cubiertos el veredicto y
  // los seis chequeos. Los cinco helpers de shell que viven en esa misma raíz
  // quedan fuera por AREA_EXTENSIONS — ver el comentario allí.
  // Subió de 53 a 54 con la compuerta `aoi:audit-protocol` y su suite (13 casos),
  // que le dan a este área 26 mutantes más que antes mataba. Nunca baja.
  'scripts/multi-harness': 55,
  // 61 → 62. El arreglo de la fuga de procesos de `mutation-probe` agregó 4
  // mutantes (137 → 141) y al principio NO estaba cubierto: el área cayó a 59.
  // Bajarlo a 59 habría sido registrar un bug como baseline. Los casos que fijan
  // el contrato de `suitePasses` —mata el grupo de procesos por las DOS vías, la
  // del timeout y la de la salida propia— matan esos 4 y los supervivientes
  // vuelven a 54, el mismo número que antes del arreglo.
  //
  // Nota que este piso no se movía desde la medición inicial, y que su área era
  // invisible para `validate-srp`: `SKIP_DIRS` saltea por NOMBRE en cualquier
  // profundidad, así que `scripts/scaffold/` entero queda fuera del conteo de
  // 300 LOC. Este archivo lo pasa. Ver el comentario en `validate-srp.mjs`.
  'scripts/scaffold': 62,
  'scripts/spatiotemporal-runtime': 59,
  // 51 → 64. El salto grande no viene de más tests sobre lo mismo: al extraer el
  // escáner compartido (`code-scanner.mjs`) el área ganó un módulo con casos
  // directos, y la compuerta de validez sintáctica mata mutantes que el barrido
  // de ahorro no tocaba (A.20: cinco archivos producían un esqueleto que
  // `node --check` rechazaba y ningún test lo miraba).
  //
  // Mide 64 y NO 67, que fue un valor intermedio: la regla de "conservar las
  // formas" agregó código cuyo valor no está atado del todo por los tests. Se
  // anota el piso medido y no el mejor visto — un piso que el área no alcanza
  // bloquea todo, y uno que se elige por conveniencia deja de ser un trinquete.
  'scripts/code-lens': 65,
  // Subió de 57 a 71 en la medición del 2026-09-12. El salto NO viene de un
  // cambio en este área: el gateway no se tocó. Es una mejora de suite que llevaba
  // tiempo sin medirse, y el trinquete la registra para que no se pierda.
  'scripts/mcp-gateway': 71,
  'scripts': 81,
  // El dashboard, que no tenía ninguna medición porque corre bajo vitest y no
  // bajo `node --test`. La sonda acepta un runner distinto y enlaza
  // node_modules y .nuxt en la copia; sin .nuxt, tsconfig.json no resuelve y
  // los 23 archivos de test fallan antes de la primera aserción.
  'aoi_apps/agentic-ops-dashboard/server/utils': 58,
}

export const TEST_GLOB = (area) => `${area}/*.test.mjs`

/**
 * Areas that need a runner other than `node --test`.
 *
 * The dashboard's suite is vitest, and the sources are TypeScript. Its copy
 * also needs `node_modules` and `.nuxt` linked, which `probe` does whenever a
 * runner is given.
 */
/**
 * Areas that mutate only some extensions.
 *
 * `scripts` (the root) holds the doctor and five installer shell helpers.
 * The helpers belong with setup.sh: their verification is a real
 * installation, not a unit suite, so mutating them buries the doctor's
 * number under sixty-three survivors that say nothing about the doctor.
 */
export const AREA_EXTENSIONS = {
  scripts: ['.mjs'],
}

export const RUNNERS = {
  'aoi_apps/agentic-ops-dashboard/server/utils': {
    command: 'npx',
    args: ['vitest', 'run', '--silent'],
    cwd: 'aoi_apps/agentic-ops-dashboard',
  },
}

/** Areas whose sources are shell rather than JavaScript. */
export const SHELL_AREAS = new Set(['scripts/conf'])

/** Compares a measured score against its floor. */
export function judge(area, killed, total, floor = MUTATION_FLOOR) {
  const score = total === 0 ? 0 : Math.round((killed / total) * 100)
  const expected = floor[area]
  if (expected === undefined) return { area, score, verdict: 'undeclared' }
  if (score < expected) return { area, score, expected, verdict: 'regressed' }
  if (score > expected) return { area, score, expected, verdict: 'improved' }
  return { area, score, expected, verdict: 'held' }
}

async function main() {
  const only = process.argv[2]
  const areas = only ? [only] : Object.keys(MUTATION_FLOOR)
  const results = []

  console.log('=== AOI Mutation Ratchet ===\n')
  for (const area of areas) {
    process.stdout.write(`${area} ... `)
    const r = await probe(
      process.cwd(),
      area,
      TEST_GLOB(area),
      Infinity,
      () => {},
      RUNNERS[area] ?? null,
      AREA_EXTENSIONS[area]
    )
    const verdict = judge(area, r.killed, r.total, MUTATION_FLOOR)
    results.push({ ...verdict, total: r.total, survivors: r.survivors.length })
    console.log(`${verdict.score}% (piso ${verdict.expected ?? '—'}) · ${r.total} mutantes · ${r.survivors.length} sobreviven`)
  }

  const regressed = results.filter((r) => r.verdict === 'regressed')
  const improved = results.filter((r) => r.verdict === 'improved')

  if (improved.length > 0) {
    console.log('\nSubieron — actualizá MUTATION_FLOOR para que el trinquete no afloje:')
    for (const r of improved) console.log(`  ${r.area}: ${r.expected} → ${r.score}`)
  }

  if (regressed.length > 0) {
    console.error('')
    for (const r of regressed) {
      console.error(`❌ ${r.area}: ${r.score}% está por debajo del piso ${r.expected}%`)
    }
    console.error('\nUna suite que restringe menos que ayer pasa igual de verde. Ese es el punto.')
    process.exit(1)
  }

  console.log('\n✅ Ninguna suite restringe menos que en su última medición.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
