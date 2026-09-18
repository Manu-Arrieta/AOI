#!/usr/bin/env node
/**
 * scripts/scaffold/validate-srp.mjs
 *
 * Repository-wide enforcement of Invariant 5: no governed source file over
 * 300 LOC.
 *
 * The rule already had a deterministic implementation (`validateFileSizes`)
 * and a test, and `/sdd-verify` reports it — but only over the files a single
 * task touched, and only as a WARNING. Nothing ever looked at the repository
 * as a whole, so three files drifted past the limit unnoticed. An invariant
 * that nothing measures is a preference.
 *
 * This is a RATCHET, not a big-bang cleanup. Splitting a 341-line module is a
 * refactor with its own risk and deserves its own task; failing the whole
 * suite until someone does it would only teach people to skip the suite. So
 * the three known offenders are listed below with their sizes, and the gate
 * fails on:
 *
 *   - any file NOT on the list that exceeds the limit  → new erosion
 *   - any file ON the list that grew                   → existing erosion
 *   - any file on the list that no longer violates     → the list is stale
 *
 * The only way the numbers move is down. Zero inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateFileSizes } from '../sdd-lifecycle/mechanical-verify-union.mjs'
import { isAoiGovernedPath, isDevelopmentRepo } from './governed-paths.mjs'

export const MAX_LOC = 300
const SOURCE_EXTENSIONS = new Set(['.mjs', '.js', '.ts'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage'])

/**
 * The mirror, as a path from the root — not as a directory name.
 *
 * `scaffold` used to sit in `SKIP_DIRS`, which the walk matches by BASENAME.
 * The intent was to skip the root mirror; the effect was to skip
 * `scripts/scaffold/`, because that directory is also named `scaffold` and it
 * is the only one the walk ever reaches — `listSourceFiles` starts at
 * `scripts/`, so the root mirror was never a candidate to begin with. The
 * entry therefore excluded nothing it meant to, and excluded an entire area of
 * governed source instead.
 *
 * Measured, and it is why the budget below is not empty: the gate reported
 * `Scanned: 197` against 216 `.mjs` files under `scripts/`. The missing 19 were
 * `scripts/scaffold/` — the area that holds the gates themselves — and five of
 * them were over the limit, including `mutation-probe.mjs` at 1143 LOC, 3.8x
 * the cap and the largest file in the repository. A gate that cannot see its
 * own area reports green by construction.
 */
const MIRROR_DIR = 'scaffold'

/**
 * Files that exceed the limit, with the size they had when they were recorded.
 * Each one is a debt, not an exemption: the number may only be lowered.
 *
 * It was empty once, and that was earned: the gate shipped with three entries
 * and all three were paid by splitting along real seams rather than by shaving
 * lines — `export-memory-bundle.mjs` lost a fifty-line argument parser
 * duplicated in its sibling, `aoi-doctor.mjs` lost the six checks it runs,
 * leaving it the one decision it actually owns, and `detect-base-project.mjs`
 * lost the pnpm-workspace parsing, which was never about classifying a project.
 *
 * It is not empty now, and nothing regressed to make it so. Fixing the mirror
 * skip above (see `MIRROR_DIR`) admitted `scripts/scaffold/` into the audit for
 * the first time, and these five were already there — debt that predates the
 * measurement, not debt that was added. Recording it at today's size is exactly
 * what the ratchet is for: the numbers may only go down from here.
 *
 * `mutation-probe.mjs` is the one to split first. It is the largest file in the
 * repository by a wide margin, and 928 test lines sit beside it, so the seam is
 * very likely real rather than cosmetic.
 *
 * Sizes are as `validateFileSizes` counts them, which is the same count
 * `/sdd-verify` reports. That is one more than `wc -l` for a file ending in a
 * newline; using the gate's own measure keeps the two from disagreeing.
 */
export const LEGACY_BUDGET = {
  'scripts/scaffold/mutation-probe.mjs': 1143,
  'scripts/scaffold/mutation-probe.test.mjs': 928,
  'scripts/scaffold/validate-scaffold-parity.mjs': 327,
  'scripts/scaffold/validate-test-globs.mjs': 355,
  'scripts/scaffold/validate-test-globs.test.mjs': 359,
}

/**
 * Lists source files to audit, skipping vendored trees and the mirror.
 *
 * In the development repository every file under scripts/ is AOI's own code,
 * so all of it is audited. In an installed workspace the same directory may
 * hold scripts the owner wrote, and Invariant 5 is AOI's rule about AOI's
 * code — judging someone else's is not our business. There, only governed
 * files are audited, which is precisely the set mirrored under scaffold/.
 */
export function listSourceFiles(root, dir = 'scripts') {
  const governedOnly = !isDevelopmentRepo(root)
  const out = []
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
      // The mirror is one specific path, not every directory that shares its
      // name. Matching by basename here is what hid `scripts/scaffold/`.
      if (path.relative(root, full) === MIRROR_DIR) continue
      // A symlink is neither `isDirectory()` nor `isFile()` to `readdirSync`,
      // so a linked directory used to be skipped entirely — 900 LOC of
      // governed source sat behind one and the ratchet reported clean. The
      // rule is about the code AOI governs, and code does not stop being
      // governed because the path to it goes through a link.
      if (entry.isSymbolicLink()) {
        let target
        try {
          target = fs.statSync(full)
        } catch {
          continue // Broken link: nothing to measure.
        }
        if (target.isDirectory()) walk(full)
        else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
          const rel = path.relative(root, full)
          if (!governedOnly || isAoiGovernedPath(root, full)) out.push(rel)
        }
        continue
      }
      if (entry.isDirectory()) walk(full)
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        const rel = path.relative(root, full)
        if (governedOnly && !isAoiGovernedPath(root, full)) continue
        out.push(rel)
      }
    }
  }
  walk(path.join(root, dir))
  return out.sort()
}

/**
 * Audits the repository against the ratchet.
 * @returns {{ scanned: number, added: Array, grown: Array, resolved: string[] }}
 */
export function auditSrp(root, budget = LEGACY_BUDGET, maxLoc = MAX_LOC) {
  const files = listSourceFiles(root)
  const violations = validateFileSizes(files.map((f) => path.join(root, f)), maxLoc)

  const current = new Map()
  for (const v of violations) current.set(path.relative(root, v.file), v.lines)

  const added = []
  const grown = []
  for (const [file, lines] of current) {
    const allowed = budget[file]
    if (allowed === undefined) added.push({ file, lines })
    else if (lines > allowed) grown.push({ file, lines, allowed })
  }
  const resolved = Object.keys(budget).filter((f) => !current.has(f))

  return { scanned: files.length, added, grown, resolved }
}

function main() {
  const root = process.cwd()
  const { scanned, added, grown, resolved } = auditSrp(root)

  console.log('=== AOI SRP Ratchet (Invariant 5) ===')
  console.log(`Scanned: ${scanned} source file(s) · limit ${MAX_LOC} LOC`)

  const failures = []
  for (const { file, lines } of added) {
    failures.push(`NEW VIOLATION   ${file} — ${lines} LOC exceeds ${MAX_LOC}`)
  }
  for (const { file, lines, allowed } of grown) {
    failures.push(`GREW            ${file} — ${lines} LOC, was ${allowed}; legacy debt may only shrink`)
  }
  for (const file of resolved) {
    failures.push(`STALE BUDGET    ${file} no longer violates — remove it from LEGACY_BUDGET`)
  }

  if (failures.length > 0) {
    console.error('')
    for (const line of failures) console.error(`❌ ${line}`)
    process.exit(1)
  }

  const debt = Object.keys(LEGACY_BUDGET).length
  console.log(`✅ No new SRP violations. ${debt} legacy file(s) still over the limit, none grown.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
