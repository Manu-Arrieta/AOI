/**
 * scripts/sdd-lifecycle/test-reachability.mjs
 *
 * Answers one question: will a runner ever execute this test file?
 *
 * Split out of invariant-gate.mjs when that file crossed the 300 LOC of
 * Invariant 5. The boundary is real: matching contract tags against test
 * sources is a different job from deciding which of those sources are
 * reachable at all, and the second question turns out to matter to more than
 * one caller.
 *
 * A live cycle is why it exists. A delegated agent wrote
 * `app/utils/token-budget.test.ts` citing all three BIC tags; the Invariant
 * Gate matched them and reported the contract enforced. Meanwhile the
 * project's `vitest.config.ts` pinned `include` to `test/**`, so the file was
 * never collected and not one assertion ran. Every gate was green over a test
 * that did not exist as far as the runner was concerned.
 */

import fs from 'node:fs'
import path from 'node:path'
import { findOrphanTests } from '../scaffold/validate-test-globs.mjs'

const TEST_EXTENSIONS = new Set(['.mjs', '.js', '.ts', '.tsx', '.jsx', '.vue', '.py', '.go', '.rs'])
// `scaffold` is a byte-for-byte mirror, not an authoritative test tree: counting
// it would let a mirrored copy satisfy a contract on its own.
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage', 'scaffold'])

/**
 * Recursively collects test file contents under a directory.
 * @param {string} dir
 * @returns {Array<{ file: string, content: string }>}
 */
export function collectTestSources(dir) {
  if (!dir || !fs.existsSync(dir)) return []

  const stat = fs.statSync(dir)
  if (stat.isFile()) {
    try {
      return [{ file: dir, content: fs.readFileSync(dir, 'utf8') }]
    } catch {
      return []
    }
  }

  const sources = []
  const walk = (current) => {
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(current, entry.name)

      if (entry.isDirectory()) {
        walk(full)
        continue
      }

      const isTest = entry.name.includes('.test.') || entry.name.includes('.spec.')
      if (!isTest || !TEST_EXTENSIONS.has(path.extname(entry.name))) continue

      try {
        sources.push({ file: full, content: fs.readFileSync(full, 'utf8') })
      } catch {
        // Ignore unreadable files
      }
    }
  }

  walk(dir)
  return sources
}

/**
 * Partitions test sources into the ones a runner collects and the ones it does not.
 *
 * **Devuelve TRES estados, no dos, y el tercero es un arreglo medido.** La versión
 * anterior, ante un `package.json` ausente o ilegible, devolvía `kept: sources` —
 * o sea, *"no pude determinar la alcanzabilidad"* se trataba como *"todo es
 * alcanzable"*.
 *
 * Una verificación adversarial encontró la consecuencia: con un `package.json`
 * corrupto, un archivo que ningún runner colecta pasaba a ser **la evidencia de
 * que el contrato está enforced**, y el Invariant Gate daba PASSED. Contradecía la
 * doctrina del propio módulo unas líneas más arriba —*"unresolvable is reported,
 * never assumed reachable"*— aplicada a las specs de vitest y no al
 * `package.json`.
 *
 * `determinable: false` no decide por el llamador: le dice que la pregunta no se
 * pudo responder, y el Invariant Gate bloquea con exit 2. Seguir sin dropear nada
 * es correcto —dropear un test real por no poder preguntar sería el mismo error al
 * revés—, pero **callarlo no lo era**.
 *
 * @param {string} root repository root
 * @param {Array<{file: string, content: string}>} sources
 * @returns {{ kept: Array, dropped: string[], determinable: boolean, reason: string }}
 */
export function dropUnreachableTests(root, sources) {
  let orphans
  try {
    orphans = new Set(findOrphanTests(root).map((o) => path.resolve(root, o.file)))
  } catch (err) {
    // No package.json, o uno ilegible: la pregunta no se pudo responder. Se
    // conservan todos los fuentes —dropear un test real por no poder preguntar
    // sería el mismo error al revés— pero se declara que la respuesta es
    // INDETERMINADA, para que quien decide no la lea como un sí.
    return {
      kept: sources,
      dropped: [],
      determinable: false,
      reason: `no se pudo leer package.json para determinar alcanzabilidad (${err?.message || 'error desconocido'})`,
    }
  }

  const kept = []
  const dropped = []
  for (const s of sources) {
    if (orphans.has(path.resolve(s.file))) dropped.push(s.file)
    else kept.push(s)
  }
  return { kept, dropped, determinable: true, reason: '' }
}
