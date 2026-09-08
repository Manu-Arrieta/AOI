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

export const MAX_LOC = 300
const SOURCE_EXTENSIONS = new Set(['.mjs', '.js', '.ts'])
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist', 'build', 'coverage', 'scaffold'])

/**
 * Files that already exceeded the limit when the gate was introduced, with the
 * size they had at that moment. Each one is a debt, not an exemption: the
 * recorded number is a ceiling that may only be lowered.
 *
 * Sizes are as `validateFileSizes` counts them, which is the same count
 * `/sdd-verify` reports. That is one more than `wc -l` for a file ending in a
 * newline; using the gate's own measure keeps the two from disagreeing.
 */
export const LEGACY_BUDGET = {
  'scripts/aoi-doctor.mjs': 317,
  'scripts/memory-sync/export-memory-bundle.mjs': 316,
  'scripts/sandbox/detect-base-project.mjs': 342,
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
  const governedOnly = !fs.existsSync(path.join(root, 'setup.sh'))
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
      if (entry.isDirectory()) walk(full)
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        const rel = path.relative(root, full)
        if (governedOnly && !fs.existsSync(path.join(root, 'scaffold', rel))) continue
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
