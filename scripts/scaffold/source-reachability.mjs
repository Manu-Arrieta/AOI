#!/usr/bin/env node
/**
 * scripts/scaffold/source-reachability.mjs
 *
 * Which source files no test ever reaches.
 *
 * A file nothing loads is covered by nothing, however green the suite looks,
 * and until this existed nobody counted. Four of AOI's own scripts were in
 * that state, including `sdd-stress-suite.mjs` — the instrument that produces
 * the savings figure every branch is judged by.
 *
 * Reachability is counted two ways on purpose. Following `import` finds the
 * libraries. But a CLI is exercised by RUNNING it, and a test that spawns
 * `node scripts/x.mjs` covers that file thoroughly while remaining invisible
 * to an import graph — so a test that names the path counts too. Measuring
 * only imports would have reported the stress-suite tests as no coverage at
 * all and pushed someone to rewrite a working test to satisfy the metric.
 *
 * Filesystem arithmetic: 0 inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const EXTS = ['.mjs', '.js']
// `scaffold` is deliberately absent: the walk starts inside `scripts/`, and
// `scripts/scaffold/` is real source. Listing it here silently excluded five
// files from the count — the same unanchored-name mistake the mutation probe
// made, in the measuring tool again.
const SKIP_DIRS = new Set(['node_modules', '.git', 'fixtures'])

/**
 * Files not reached by any test, each with why it is exempt.
 *
 * A ratchet, not an aspiration: the list may only shrink. An entry here says
 * the absence is understood, not that it is fine.
 */
export const UNREACHED_BUDGET = {}

function walk(dir, keep, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, keep, out)
    else if (keep(entry.name)) out.push(full)
  }
  return out
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), spec)
  for (const candidate of [base, ...EXTS.map((e) => base + e)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * Every source a test reaches, by import or by naming its path to run it.
 * @returns {Set<string>} repo-relative paths
 */
export function reachableFromTests(root, dir = 'scripts') {
  const sourceRoot = path.join(root, dir)
  const tests = walk(sourceRoot, (n) => n.endsWith('.test.mjs'))
  const sources = walk(sourceRoot, (n) => EXTS.includes(path.extname(n)) && !n.endsWith('.test.mjs'))
  const byBasename = new Map(sources.map((s) => [path.basename(s), path.relative(root, s)]))

  const reached = new Set()
  const queue = [...tests]

  while (queue.length > 0) {
    const file = queue.pop()
    let text
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }

    for (const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      const target = resolveImport(file, m[1])
      if (!target) continue
      const rel = path.relative(root, target)
      if (reached.has(rel)) continue
      reached.add(rel)
      queue.push(target)
    }

    // A test that spawns the script covers it, and no import graph sees that.
    // The spawned file is queued like any other, so everything IT imports
    // counts too — running a script exercises its whole dependency tree.
    for (const m of text.matchAll(/['"`]([A-Za-z0-9_.-]+\.mjs)['"`]/g)) {
      const rel = byBasename.get(m[1])
      if (!rel || reached.has(rel)) continue
      reached.add(rel)
      queue.push(path.join(root, rel))
    }
  }
  return reached
}

/** @returns {{ unreached: string[], added: string[], stale: string[], scanned: number }} */
export function auditReachability(root, budget = UNREACHED_BUDGET, dir = 'scripts') {
  const sources = walk(path.join(root, dir), (n) => EXTS.includes(path.extname(n)) && !n.endsWith('.test.mjs')).map(
    (p) => path.relative(root, p)
  )
  const reached = reachableFromTests(root, dir)
  const unreached = sources.filter((s) => !reached.has(s)).sort()
  return {
    scanned: sources.length,
    unreached,
    added: unreached.filter((f) => !(f in budget)),
    stale: Object.keys(budget).filter((f) => reached.has(f) || !sources.includes(f)),
  }
}

function main() {
  const root = process.cwd()
  const { scanned, unreached, added, stale } = auditReachability(root)

  console.log('=== AOI Source Reachability ===')
  console.log(`Scanned: ${scanned} source file(s) · ${scanned - unreached.length} alcanzadas`)

  const failures = []
  for (const f of added) failures.push(`SIN ALCANZAR   ${f} — ningún test lo carga ni lo ejecuta`)
  for (const f of stale) failures.push(`PRESUPUESTO VIEJO  ${f} ya está alcanzado — sacálo de UNREACHED_BUDGET`)

  if (failures.length > 0) {
    console.error('')
    for (const line of failures) console.error(`❌ ${line}`)
    console.error('\nUn archivo que ningún test carga no lo verifica nada, por verde que esté la suite.')
    process.exit(1)
  }

  const debt = Object.keys(UNREACHED_BUDGET).length
  console.log(`✅ Toda fuente se alcanza, salvo ${debt} exención declarada.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
