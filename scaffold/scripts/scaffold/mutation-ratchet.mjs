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
  'scripts/subagent-context': 68,
  'scripts/sandbox': 78,
  'scripts/memory-sync': 52,
  'scripts/sdd-lifecycle': 61,
  // Shell. The installer machinery is where the most destructive defects of
  // the audit lived, so leaving it unmeasured left the worst code in the
  // project outside the only check that asks whether its tests bind.
  'scripts/conf': 62,
  // Las seis que nunca se habían medido. `scripts` (la raíz) es aoi-doctor y
  // salió 15%: el peor del repositorio, y el que le dice al Owner que su
  // workspace está sano. Su veredicto ya quedó cubierto; el resto de su
  // superficie no.
  'scripts/multi-harness': 53,
  'scripts/scaffold': 57,
  'scripts/spatiotemporal-runtime': 59,
  'scripts/code-lens': 51,
  'scripts/mcp-gateway': 57,
  'scripts': 15,
}

export const TEST_GLOB = (area) => `${area}/*.test.mjs`

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
    const r = await probe(process.cwd(), area, TEST_GLOB(area))
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
