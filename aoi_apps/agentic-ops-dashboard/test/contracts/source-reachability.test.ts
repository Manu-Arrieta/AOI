/**
 * test/contracts/source-reachability.test.ts
 *
 * A source file no test ever loads is not covered by anything, however green
 * the suite looks. The audit found the dashboard in that state and nothing
 * measured it, so the number could only grow.
 *
 * This is a RATCHET, not a demand for full coverage. Each file below is listed
 * with why it is not reached, and the list may only shrink:
 *
 *   - any unlisted source no test reaches   → new erosion
 *   - any listed file a test now reaches    → the list is stale
 *
 * Reachability is computed by following imports from the test files, which
 * costs nothing and needs no coverage provider. It answers "was this module
 * ever loaded", not "were its branches exercised" — a weaker question, but the
 * one the finding was about, and a file that is never loaded cannot have been
 * checked by anything.
 */

import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const SOURCE_DIRS = ['server', 'shared', 'app/composables']
const EXTS = ['.ts', '.mjs', '.js']

/**
 * Files not reached by any test, each with the reason it is exempt.
 *
 * Nitro route handlers are three to five lines of parse-delegate-map: the
 * logic they wrap IS reached, and covering the wrapper would mean adding a
 * Nitro test harness to assert that `defineEventHandler` calls the function
 * written directly beneath it.
 */
export const UNREACHED_BUDGET: Record<string, string> = {
  // Los siete handlers de Nitro son de tres a ocho líneas de
  // parsear-delegar-mapear, y la lógica que envuelven SÍ está cubierta.
  // Importarlos en vitest falla con "Cannot find package 'h3'": h3 llega
  // transitivamente por Nuxt y no resuelve desde la raíz del dashboard.
  // Agregarlo como dependencia le suma peso de instalación al workspace de
  // cada Owner para verificar que `defineEventHandler(fn)` llama a `fn`.
  // Comprobado, no supuesto.
  'server/api/resources/create.post.ts': 'glue Nitro sobre resource-operations, que sí está cubierto; h3 no resuelve en vitest',
  'server/api/resources/delete.post.ts': 'glue Nitro sobre resource-operations, que sí está cubierto; h3 no resuelve en vitest',
  'server/api/resources/move.post.ts': 'glue Nitro sobre resource-operations, que sí está cubierto; h3 no resuelve en vitest',
  'server/api/tasks/[taskId].get.ts': 'glue Nitro sobre build-workspace-snapshot; h3 no resuelve en vitest',
  'server/api/token-observability/config.post.ts': 'glue Nitro sobre token-observability-config; h3 no resuelve en vitest',
  'server/api/token-observability/summary.get.ts': 'glue Nitro sobre collect-copilot-token-usage; h3 no resuelve en vitest',
  'server/api/workspace.get.ts': 'glue Nitro sobre build-workspace-snapshot y watch-workspace; h3 no resuelve en vitest',
  // Los cuatro composables son ciclo de vida de Vue: montarlos exige
  // @vue/test-utils, y su lógica pura ya se extrajo donde la había.
  'app/composables/useDoctor.ts': 'composable de ciclo de vida Vue; la lógica vive en /api/doctor',
  'app/composables/useMemoryExplorer.ts': 'composable de ciclo de vida Vue sobre /api/memory',
  'app/composables/useTokenObservability.ts': 'composable de ciclo de vida Vue sobre /api/token-observability',
  'app/composables/useWorkspace.ts':
    'ciclo de vida Vue y SSE; su única lógica pura se extrajo a app/utils/refresh-options.ts, que sí se prueba',
}

function walk(dir: string, keep: (f: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, keep, out)
    else if (keep(name)) out.push(p)
  }
  return out
}

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else if (spec.startsWith('~~/')) base = join(APP, spec.slice(3))
  else if (spec.startsWith('~/')) base = join(APP, spec.slice(2))
  else return null
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, 'index' + e))]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

/** Every source file transitively imported from a test file. */
export function reachableFromTests(app = APP): Set<string> {
  const queue = walk(join(app, 'test'), (f) => f.endsWith('.test.ts'))
  const reached = new Set<string>()
  while (queue.length) {
    const file = queue.pop()!
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const m of text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, m[1])
      if (!target) continue
      const rel = relative(app, target)
      if (reached.has(rel)) continue
      reached.add(rel)
      queue.push(target)
    }
  }
  return reached
}

const sources = SOURCE_DIRS.flatMap((d) =>
  walk(join(APP, d), (f) => EXTS.includes(extname(f)) && !f.endsWith('.test.ts'))
).map((p) => relative(APP, p))

// The ratchet judges AOI's own dashboard. In an installed workspace the same
// directories hold whatever the owner built, and their coverage is their call.
const isDevRepo = existsSync(join(APP, '../../setup.sh'))

describe('every dashboard source is loaded by some test, or is a declared exemption', () => {
  const reached = reachableFromTests()
  const unreached = sources.filter((s) => !reached.has(s))

  it('finds sources and tests, so the ratchet is not vacuous', () => {
    expect(sources.length).toBeGreaterThan(10)
    expect(reached.size).toBeGreaterThan(0)
  })

  it.skipIf(!isDevRepo)('no source outside the budget goes unloaded', () => {
    const added = unreached.filter((f) => !(f in UNREACHED_BUDGET))
    expect(added, `estos archivos no los carga ningún test y no están declarados:\n  ${added.join('\n  ')}`).toEqual([])
  })

  it.skipIf(!isDevRepo)('the budget carries no file a test now reaches', () => {
    const stale = Object.keys(UNREACHED_BUDGET).filter((f) => reached.has(f) || !sources.includes(f))
    expect(stale, `ya alcanzados o inexistentes; sacálos de UNREACHED_BUDGET:\n  ${stale.join('\n  ')}`).toEqual([])
  })

  it('every exemption states a reason', () => {
    for (const [file, reason] of Object.entries(UNREACHED_BUDGET)) {
      expect(reason.length, `${file} sin motivo`).toBeGreaterThan(15)
    }
  })
})
