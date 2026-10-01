import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'
import { parseCliArgs } from './install-git-guard.mjs'

// Separado de install-git-guard.test.mjs, que con estos casos pasaba de 300 LOC.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const created = []
after(() => created.forEach((d) => fs.rmSync(d, { recursive: true, force: true })))
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gitguard-args-'))
  created.push(root)
  fs.mkdirSync(path.join(root, '.git', 'hooks'), { recursive: true })
  return root
}

describe('a typo in --audit does not run the writing path', () => {
  // Regresión de D1, medida en una copia: `--audti` no era `--audit` para
  // `argv.includes`, así que corría la instalación, escribía
  // `.git/hooks/commit-msg` y salía con 0.
  const CLI = path.join(REPO, 'scripts/multi-harness/install-git-guard.mjs')

  for (const args of [['--audti'], ['--audit', 'extra']]) {
    it(`exits 2 and leaves .git/hooks untouched for ${args.join(' ')}`, () => {
      const root = workspace()
      const r = spawnSync(process.execPath, [CLI, ...args], { cwd: root, encoding: 'utf8' })
      assert.equal(r.status, 2, r.stderr)
      assert.match(r.stderr, /argumento desconocido/)
      assert.deepEqual(fs.readdirSync(path.join(root, '.git', 'hooks')), [])
    })
  }

  it('parseCliArgs knows flags, options with values, and nothing else', () => {
    assert.deepEqual(parseCliArgs(['--audit'], { flags: ['--audit'] }), { values: { audit: true }, error: null })
    assert.deepEqual(parseCliArgs([], { flags: ['--audit'] }), { values: {}, error: null })
    assert.equal(parseCliArgs(['--x', 'v'], { options: ['--x'] }).values.x, 'v')
    assert.match(parseCliArgs(['--x'], { options: ['--x'] }).error, /necesita un valor/)
    assert.match(parseCliArgs(['--x', '--audit'], { flags: ['--audit'], options: ['--x'] }).error, /necesita un valor/)
    assert.match(parseCliArgs(['--audti'], { flags: ['--audit'] }).error, /desconocido: --audti/)
  })
})
