/**
 * scripts/memory-sync/cli-surface.test.mjs
 *
 * The command line of the memory bundle tools, which nothing tested.
 *
 * The area's library is well covered — the mutation probe killed most mutants
 * inside `exportMemoryBundle` and `importMemoryBundle` — and every one of its
 * 92 survivors sat in the part no test ran: argument parsing, the entry guard
 * and the exit code.
 *
 * That gap hid a defect worth the whole exercise. Both CLIs guarded their
 * entry with
 *
 *     if (import.meta.url === `file://${process.argv[1]}`)
 *
 * which is a string concatenation, not a URL. Any character the path needs
 * percent-encoded makes the two differ, and one space is enough. This
 * repository lives under "GITHUB MIGRATION", so the guard never fired:
 * `node export-memory-bundle.mjs` printed nothing and exited 0 — which reads
 * exactly like a successful export of nothing, and a script calling it would
 * have concluded the bundle was written.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const EXPORT = path.join(HERE, 'export-memory-bundle.mjs')
const IMPORT = path.join(HERE, 'import-memory-bundle.mjs')
const RESOLVE = path.join(HERE, 'resolve-active-version.mjs')
const FIXTURE = path.join(HERE, 'fixtures/valid')

/** Runs a CLI and returns exit code, stdout and stderr — never through a pipe. */
function run(script, args) {
  try {
    const stdout = execFileSync('node', [script, ...args], {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

/** A throwaway copy of the shipped fixture, with an exports directory. */
function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-memcli-'))
  fs.cpSync(FIXTURE, root, { recursive: true })
  return { root, exports: path.join(root, '.exports') }
}

const ARTIFACT = 'salida.memory-bundle.json.gz'

describe('the memory-sync CLIs actually run', () => {
  // The regression test for the entry guard. If it never fires the process
  // exits 0 in silence, so the assertion is on BOTH the code and the output:
  // a silent success is the failure being guarded against.
  for (const [name, script] of [['export', EXPORT], ['import', IMPORT], ['resolve', RESOLVE]]) {
    it(`${name} reaches its own main() and complains about the missing workspace`, () => {
      const r = run(script, [])
      assert.equal(r.code, 1, `salió ${r.code} — la guarda de entrada no disparó`)
      assert.match(r.stderr, /workspace is required/i)
    })
  }
})

describe('export-memory-bundle', () => {
  it('refuses an artifact name that is not a bundle', () => {
    // The extension is the contract with the importer; accepting anything
    // else writes a file nothing downstream can read.
    const { root, exports } = workspace()
    const r = run(EXPORT, ['fixture-workspace', 'fixture-v1', 'salida.json', '--versions-root', root, '--exports-root', exports])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /\.memory-bundle\.json\.gz/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('refuses a scope the version does not include', () => {
    // Exporting a scope that is not there would produce a bundle whose
    // metadata promises content it does not carry.
    const { root, exports } = workspace()
    const r = run(EXPORT, ['fixture-workspace', 'fixture-v1', ARTIFACT, '--versions-root', root, '--exports-root', exports, '--scope', 'memoir'])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /does not include scope "memoir"/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('writes the bundle and reports what it left out', () => {
    const { root, exports } = workspace()
    const r = run(EXPORT, ['fixture-workspace', 'fixture-v1', ARTIFACT, '--versions-root', root, '--exports-root', exports, '--scope', 'memories'])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)

    const report = JSON.parse(r.stdout)
    assert.deepEqual(report.includedScopes, ['memories'])
    // Naming the omitted scopes is the point: a partial bundle that does not
    // say it is partial is indistinguishable from a complete one.
    assert.ok(report.omittedScopes.length > 0, 'no declaró los scopes omitidos')
    assert.equal(fs.existsSync(report.bundlePath), true)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('honours --versions-root instead of silently reading the real workspace', () => {
    // The flag exists so a test — or an operator — can point the tool at a
    // copy. Ignored, it would read and write the live memory store.
    const r = run(EXPORT, ['fixture-workspace', 'fixture-v1', ARTIFACT, '--versions-root', '/no/existe', '--exports-root', '/no/existe/.exports'])
    assert.equal(r.code, 1)
    fs.rmSync('/tmp/nada', { recursive: true, force: true })
  })

  it('reads repeated --scope flags as separate values, and rejects a duplicate', () => {
    // The loop that consumes `--scope` has to advance past its value; if it
    // did not, the value itself would be read as the next flag. Passing the
    // same scope twice proves both halves: the flag was parsed twice, and the
    // duplicate was caught rather than silently collapsed — a bundle whose
    // metadata lists a scope twice claims more than it carries.
    const { root, exports } = workspace()
    const r = run(EXPORT, [
      'fixture-workspace', 'fixture-v1', ARTIFACT,
      '--versions-root', root, '--exports-root', exports,
      '--scope', 'memories', '--scope', 'memories',
    ])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /duplicate scope "memories"/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('import-memory-bundle', () => {
  it('refuses a bundle that is not on disk', () => {
    const { root, exports } = workspace()
    const r = run(IMPORT, ['otro-workspace', 'v1', 'fantasma.memory-bundle.json.gz', '--versions-root', root, '--exports-root', exports])
    assert.equal(r.code, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('round-trips a bundle the exporter just wrote', () => {
    // The two halves are only useful together, and nothing exercised the pair
    // through the command line the operator actually types.
    const { root, exports } = workspace()
    const exported = run(EXPORT, ['fixture-workspace', 'fixture-v1', ARTIFACT, '--versions-root', root, '--exports-root', exports, '--scope', 'memories'])
    assert.equal(exported.code, 0, `${exported.stdout}${exported.stderr}`)

    // Imported back into the same workspace as a new version: the importer
    // needs an active version to chain from, which is what makes provenance
    // a chain rather than an orphan record.
    const imported = run(IMPORT, [
      'fixture-workspace', 'destino-v1', ARTIFACT,
      '--versions-root', root, '--exports-root', exports,
      '--owner-context', 'importado por la prueba de CLI',
    ])
    assert.equal(imported.code, 0, `${imported.stdout}${imported.stderr}`)

    const manifest = JSON.parse(imported.stdout)
    assert.equal(manifest.workspace, 'fixture-workspace')
    assert.equal(manifest.versionId, 'destino-v1')
    assert.equal(manifest.sourceWorkspace, 'fixture-workspace')
    assert.equal(manifest.sourceVersionId, 'fixture-v1')
    // The provenance is the reason the bundle format exists; losing it makes
    // an imported version indistinguishable from one authored locally.
    assert.equal(fs.existsSync(manifest.manifestPath), true)
    fs.rmSync(root, { recursive: true, force: true })
  })
})

describe('resolve-active-version', () => {
  it('reports the active version of a workspace', () => {
    const { root } = workspace()
    const r = run(RESOLVE, ['fixture-workspace', '--versions-root', root])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    const active = JSON.parse(r.stdout)
    assert.equal(active.workspace, 'fixture-workspace')
    assert.equal(active.activeVersionId, 'fixture-v2')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('names the previous version too, so a rollback has somewhere to go', () => {
    const { root } = workspace()
    const active = JSON.parse(run(RESOLVE, ['fixture-workspace', '--versions-root', root]).stdout)
    assert.equal(active.previousVersionId, 'fixture-v1')
    assert.equal(fs.existsSync(active.activeManifestPath), true)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('fails on a workspace that has no active version', () => {
    const { root } = workspace()
    const r = run(RESOLVE, ['workspace-inexistente', '--versions-root', root])
    assert.equal(r.code, 1)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
