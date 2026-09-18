import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { auditScaffoldTracking, trackedFiles } from './validate-scaffold-tracked.mjs'

/**
 * A real git repository, not a stub.
 *
 * The whole defect lives in how git resolves `scaffold/.gitignore` against a
 * nested path, so a fake index would assert the mock and prove nothing about
 * the rule that actually bit.
 */
function gitFixture(files, { withSetup = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-tracked-'))
  if (withSetup) fs.writeFileSync(path.join(root, 'setup.sh'), '#!/usr/bin/env bash\n')

  for (const [relativePath, contents] of Object.entries(files)) {
    const full = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, contents)
  }

  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '-A'], { cwd: root })
  return root
}

const GOVERNED = ['scripts']

test('trackedFiles reads the index, so a staged file already counts', () => {
  const root = gitFixture({ 'scripts/a.mjs': 'export const a = 1\n' })

  assert.ok(trackedFiles(root).has('scripts/a.mjs'))

  fs.rmSync(root, { recursive: true, force: true })
})

test('a mirror ignored by scaffold/.gitignore FAILS, though it exists on disk', () => {
  // The exact shape that shipped twice: the root file is tracked, the mirror is
  // byte-identical on disk, and `scaffold/.gitignore` keeps it out of the index.
  const root = gitFixture({
    'scaffold/.gitignore': 'scripts/\n',
    'scripts/sync-paths.mjs': 'export const paths = []\n',
    'scaffold/scripts/sync-paths.mjs': 'export const paths = []\n',
  })

  const result = auditScaffoldTracking(root, GOVERNED)

  assert.equal(result.valid, false)
  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0], /UNTRACKED_GOVERNED_FILE/)
  assert.match(result.errors[0], /scaffold\/scripts\/sync-paths\.mjs/)

  fs.rmSync(root, { recursive: true, force: true })
})

test('parity alone cannot see it — both sides exist and match byte for byte', async () => {
  const { validateScaffoldParity } = await import('./validate-scaffold-parity.mjs')
  const root = gitFixture({
    // The root counterpart keeps parity's STRAY_IN_SCAFFOLD check quiet, so the
    // assertion below measures the mirror and nothing else — as in the real repo.
    '.gitignore': 'node_modules/\n',
    'scaffold/.gitignore': 'scripts/\n',
    'scripts/sync-paths.mjs': 'export const paths = []\n',
    'scaffold/scripts/sync-paths.mjs': 'export const paths = []\n',
  })

  assert.equal(validateScaffoldParity(root, GOVERNED).valid, true)
  assert.equal(auditScaffoldTracking(root, GOVERNED).valid, false)

  fs.rmSync(root, { recursive: true, force: true })
})

test('the same mirror PASSES once it is force-added', () => {
  const root = gitFixture({
    'scaffold/.gitignore': 'scripts/\n',
    'scripts/sync-paths.mjs': 'export const paths = []\n',
    'scaffold/scripts/sync-paths.mjs': 'export const paths = []\n',
  })
  execFileSync('git', ['add', '-f', 'scaffold/scripts/sync-paths.mjs'], { cwd: root })

  const result = auditScaffoldTracking(root, GOVERNED)

  assert.equal(result.valid, true, result.errors.join('\n'))
  assert.ok(result.checkedFilesCount >= 2)

  fs.rmSync(root, { recursive: true, force: true })
})

test('an untracked file on the ROOT side fails too — it ships from neither tree', () => {
  const root = gitFixture({ 'scripts/kept.mjs': 'export const kept = 1\n' })
  fs.writeFileSync(path.join(root, 'scripts', 'stray.mjs'), 'export const stray = 1\n')

  const result = auditScaffoldTracking(root, GOVERNED)

  assert.equal(result.valid, false)
  assert.match(result.errors.join('\n'), /scripts\/stray\.mjs/)

  fs.rmSync(root, { recursive: true, force: true })
})

test('an installed workspace is not judged: no setup.sh, no mirror to version', () => {
  const root = gitFixture(
    { 'scaffold/.gitignore': 'scripts/\n', 'scaffold/scripts/sync-paths.mjs': 'export const paths = []\n' },
    { withSetup: false }
  )

  const result = auditScaffoldTracking(root, GOVERNED)

  assert.equal(result.sourceRepo, false)
  assert.equal(result.valid, true)
  assert.equal(result.checkedFilesCount, 0)

  fs.rmSync(root, { recursive: true, force: true })
})
