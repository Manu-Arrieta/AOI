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
 * @param {string} root repository root
 * @param {Array<{file: string, content: string}>} sources
 * @returns {{ kept: Array, dropped: string[] }}
 */
export function dropUnreachableTests(root, sources) {
  let orphans
  try {
    orphans = new Set(findOrphanTests(root).map((o) => path.resolve(root, o.file)))
  } catch {
    // No package.json, or an unreadable one: reachability has no answer here,
    // so every source stands rather than being silently discarded. Dropping a
    // real test because the question could not be asked would be the same
    // class of error this module exists to prevent, pointed the other way.
    return { kept: sources, dropped: [] }
  }

  const kept = []
  const dropped = []
  for (const s of sources) {
    if (orphans.has(path.resolve(s.file))) dropped.push(s.file)
    else kept.push(s)
  }
  return { kept, dropped }
}
