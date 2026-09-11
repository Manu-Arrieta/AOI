/**
 * scripts/scaffold/source-reachability.test.mjs
 *
 * The gate counts which sources no test reaches, so a defect in the counter
 * hides exactly what it was built to find. Its first version had two, and
 * both were the same mistakes this repository keeps making in its own tools:
 * an unanchored directory name that excluded `scripts/scaffold/` from the
 * scan entirely, and an import graph that stopped at a script invoked as a
 * subprocess, reporting its whole dependency tree as uncovered.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditReachability, reachableFromTests, UNREACHED_BUDGET } from './source-reachability.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** A throwaway tree of sources and tests under `scripts/`. */
function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-reach-'))
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, body)
  }
  return root
}

describe('reachability counts both ways a test can exercise a file', () => {
  it('counts a file a test imports', () => {
    const root = tree({
      'scripts/a/lib.mjs': 'export const x = 1\n',
      'scripts/a/lib.test.mjs': "import { x } from './lib.mjs'\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/lib.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('counts a file a test only spawns', () => {
    // A CLI is exercised by RUNNING it. Measuring imports alone would report
    // a thorough subprocess test as no coverage and push someone to rewrite
    // a working test to satisfy the metric.
    const root = tree({
      'scripts/a/cli.mjs': 'console.log(1)\n',
      'scripts/a/cli.test.mjs': "execFileSync('node', [path.join(HERE, 'cli.mjs')])\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/cli.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('counts what a spawned script imports, because running it runs those too', () => {
    const root = tree({
      'scripts/a/helper.mjs': 'export const y = 2\n',
      'scripts/a/cli.mjs': "import { y } from './helper.mjs'\n",
      'scripts/a/cli.test.mjs': "execFileSync('node', ['cli.mjs'])\n",
    })
    const reached = reachableFromTests(root)
    assert.ok(reached.has('scripts/a/cli.mjs'))
    assert.ok(reached.has('scripts/a/helper.mjs'), 'no siguió los imports del script ejecutado')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('follows imports transitively', () => {
    const root = tree({
      'scripts/a/deep.mjs': 'export const z = 3\n',
      'scripts/a/mid.mjs': "import { z } from './deep.mjs'\nexport const y = z\n",
      'scripts/a/mid.test.mjs': "import { y } from './mid.mjs'\n",
    })
    assert.ok(reachableFromTests(root).has('scripts/a/deep.mjs'))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not count a file nothing mentions', () => {
    const root = tree({
      'scripts/a/huerfano.mjs': 'export const x = 1\n',
      'scripts/a/otro.test.mjs': "import assert from 'node:assert/strict'\n",
    })
    assert.equal(reachableFromTests(root).has('scripts/a/huerfano.mjs'), false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('scans a directory named scaffold like any other', () => {
    // The first version skipped it by name, which silently dropped five real
    // source files from the count — in the tool built to find dropped files.
    const root = tree({
      'scripts/scaffold/gate.mjs': 'export const g = 1\n',
      'scripts/scaffold/gate.test.mjs': "import { g } from './gate.mjs'\n",
    })
    const audit = auditReachability(root, {})
    assert.equal(audit.scanned, 1, 'no contó la fuente bajo scripts/scaffold')
    assert.deepEqual(audit.unreached, [])
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('the ratchet', () => {
  it('reports an unreached file that no budget declares', () => {
    const root = tree({ 'scripts/a/solo.mjs': 'export const x = 1\n', 'scripts/a/n.test.mjs': 'const a = 1\n' })
    assert.deepEqual(auditReachability(root, {}).added, ['scripts/a/solo.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts an unreached file the budget declares', () => {
    const root = tree({ 'scripts/a/solo.mjs': 'export const x = 1\n', 'scripts/a/n.test.mjs': 'const a = 1\n' })
    const audit = auditReachability(root, { 'scripts/a/solo.mjs': 'motivo declarado' })
    assert.deepEqual(audit.added, [])
    assert.deepEqual(audit.stale, [])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a budget entry that is now reached, so the list cannot rot', () => {
    const root = tree({
      'scripts/a/lib.mjs': 'export const x = 1\n',
      'scripts/a/lib.test.mjs': "import { x } from './lib.mjs'\n",
    })
    const audit = auditReachability(root, { 'scripts/a/lib.mjs': 'ya no corresponde' })
    assert.deepEqual(audit.stale, ['scripts/a/lib.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('flags a budget entry for a file that no longer exists', () => {
    const root = tree({ 'scripts/a/lib.mjs': 'export const x = 1\n' })
    assert.deepEqual(auditReachability(root, { 'scripts/a/borrado.mjs': 'motivo' }).stale, ['scripts/a/borrado.mjs'])
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('every shipped exemption states a reason', () => {
    for (const [file, reason] of Object.entries(UNREACHED_BUDGET)) {
      assert.ok(reason.length > 20, `${file} sin motivo suficiente`)
    }
  })

  it('holds on the real repository', () => {
    const audit = auditReachability(REPO)
    assert.ok(audit.scanned > 40, `sólo escaneó ${audit.scanned} fuentes`)
    assert.deepEqual(audit.added, [])
    assert.deepEqual(audit.stale, [])
  })
})
