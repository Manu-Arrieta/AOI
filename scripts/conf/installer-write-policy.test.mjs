/**
 * scripts/conf/installer-write-policy.test.mjs
 *
 * One rule, and every installer bug this audit found in the merge was a
 * violation of it: **the three-way merge is the only writer of a governed
 * file.**
 *
 * A second writer breaks the merge in one of two ways depending on when it
 * runs. Before the comparison, it replaces the owner's bytes with AOI's, so
 * the comparator reads its own installer's output, finds it different from the
 * recorded baseline and reports a CONFLICT against a file nobody touched —
 * observed on the real installation for `.githooks/pre-commit-aoi-guard.sh`.
 * After the comparison, it simply overwrites whatever the merge decided,
 * which is how `pnpm-workspace.yaml` was replaced in projects that already had
 * one, and how 53% of the tree used to be overwritten after being classified
 * SKIP.
 *
 * The rule has exactly two sanctioned exceptions, both explicit:
 *
 *   - the merge's own apply loops, which write `"$PROJECT_PATH/$rel_file"`
 *   - `install_governed_seed`, which writes only when the file is ABSENT,
 *     because a couple of phases run before the merge and need the file to
 *     exist to wire a hook
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { DEFAULT_SYNC_PATHS } from '../scaffold/validate-scaffold-parity.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SETUP = fs.readFileSync(path.join(REPO, 'setup.sh'), 'utf8')

/** Commands that put bytes on disk at a literal destination. */
const WRITE_TO_LITERAL = /(?:\bcp\b|\brsync\b|\bmv\b|cat\s*>|\btee\b)[^\n]*?"\$PROJECT_PATH\/([^"$]+)"/g

export function isGoverned(rel, governed = DEFAULT_SYNC_PATHS) {
  return governed.some((g) => rel === g || rel.startsWith(g + '/'))
}

/**
 * Unguarded writes into a governed path, as `{ line, target }`.
 *
 * Only literal destinations are examined: the merge's loops interpolate
 * `$rel_file`, and `install_governed_seed` receives its destination as an
 * argument, so neither can match by construction — which is precisely what
 * makes them the sanctioned spellings.
 */
export function unguardedGovernedWrites(script, governed = DEFAULT_SYNC_PATHS) {
  const found = []
  script.split('\n').forEach((line, i) => {
    if (/^\s*#/.test(line)) return
    for (const m of line.matchAll(WRITE_TO_LITERAL)) {
      if (isGoverned(m[1], governed)) found.push({ line: i + 1, target: m[1] })
    }
  })
  return found
}

describe('the merge is the only writer of a governed file', () => {
  it('setup.sh writes no governed path directly', () => {
    const offenders = unguardedGovernedWrites(SETUP)
    assert.deepEqual(
      offenders,
      [],
      'Estas escrituras pisan un archivo gobernado fuera del merge:\n' +
        offenders.map((o) => `  setup.sh:${o.line}  ${o.target}`).join('\n') +
        '\nUsá install_governed_seed (escribe sólo si falta) o dejá que lo resuelva el merge.'
    )
  })

  it('seeds the two files that earlier phases need, without overwriting them', () => {
    // The wrapper and the guard are wired before the merge runs, so they have
    // to exist by then. Seeding is the narrow exception; overwriting is not.
    assert.match(SETUP, /install_governed_seed\(\)\s*\{/)
    assert.match(SETUP, /if \[ -f "\$dest" \]; then/)
    assert.match(SETUP, /install_governed_seed "\$WRAP_SRC"/)
    assert.match(SETUP, /install_governed_seed "\$GUARD_SRC"/)
  })

  it('recognises a violation, so the gate is not vacuous', () => {
    const injected = SETUP + '\ncp "$SRC" "$PROJECT_PATH/CLAUDE.md"\n'
    const offenders = unguardedGovernedWrites(injected)
    assert.equal(offenders.length, 1)
    assert.equal(offenders[0].target, 'CLAUDE.md')
  })

  it('does not flag a write outside the governed tree', () => {
    const benign = 'cp "$SRC" "$PROJECT_PATH/scripts/bin/aoi-copilot"\n'
    assert.deepEqual(unguardedGovernedWrites(benign), [])
  })
})
