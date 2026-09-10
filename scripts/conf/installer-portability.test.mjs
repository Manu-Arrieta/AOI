/**
 * scripts/conf/installer-portability.test.mjs
 *
 * setup.sh runs with `set -euo pipefail`, which turns any command that exits
 * non-zero into an aborted install. That makes a shell idiom which merely
 * behaves differently on another platform into a hard failure there.
 *
 * The one that shipped was `sed -i ''`. It is the BSD spelling: BSD sed takes
 * the backup suffix as a separate argument, GNU sed takes it attached to the
 * flag. Under GNU sed the empty string is therefore read as the SCRIPT, the
 * real expression becomes a filename, sed exits non-zero and the installer
 * dies mid-run on every Linux machine.
 *
 * The guarded spelling is fine and is used elsewhere in the repository:
 * probe `sed --version` and branch. What this gate forbids is the bare form,
 * which silently assumes macOS.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SKIP_DIRS = new Set(['node_modules', '.git', 'scaffold', '.nuxt', '.output', 'dist', 'coverage'])

/** Every shell script AOI ships, repo-relative. */
export function shellScripts(root) {
  const out = []
  const walk = (dir) => {
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.name.endsWith('.sh')) out.push(path.relative(root, full))
    }
  }
  walk(root)
  return out.sort()
}

/** Lines using an idiom, ignoring comments — a comment explaining it is not a use. */
export function usesIdiom(text, pattern) {
  return String(text)
    .split('\n')
    .filter((line) => !/^\s*#/.test(line) && pattern.test(line))
}

const BARE_SED_IN_PLACE = /(?<!#.*)\bsed\s+-i\s+''/

describe('the installer runs on more than one sed', () => {
  const scripts = shellScripts(REPO)

  it('finds the shell scripts, so the gate is not vacuous', () => {
    assert.ok(scripts.includes('setup.sh'), `no encontró setup.sh: ${scripts.length} scripts`)
  })

  it("never uses bare `sed -i ''` without probing the dialect first", () => {
    const offenders = []
    for (const rel of scripts) {
      const text = fs.readFileSync(path.join(REPO, rel), 'utf8')
      const hits = usesIdiom(text, BARE_SED_IN_PLACE)
      if (hits.length === 0) continue
      // The guarded form probes GNU sed and branches; that one is correct.
      if (/sed\s+--version/.test(text)) continue
      offenders.push(`${rel}: ${hits[0].trim()}`)
    }
    assert.deepEqual(
      offenders,
      [],
      `\`sed -i ''\` sin sonda de dialecto aborta el instalador en Linux:\n  ${offenders.join('\n  ')}`
    )
  })

  it('setup.sh does not depend on any sed dialect at all', () => {
    // The installer is the script that must run everywhere unattended, so it
    // materialises files with python3 — already a hard dependency of the
    // merge — rather than betting on which sed the host ships.
    const text = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')
    assert.deepEqual(usesIdiom(text, /\bsed\s+-i\b/), [])
  })
})
