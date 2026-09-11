/**
 * scripts/sandbox/cli-surface.test.mjs
 *
 * The command line of the sandbox manifest renderer.
 *
 * `generate-manifest-md` turns an integration manifest into the Markdown a
 * human reads before approving a sandbox. Its `main()` decides three things
 * nothing tested: whether a path was given, whether the file parses, and
 * whether the result goes to stdout or to a file beside the input.
 *
 * The third is the one that matters most in the wrong direction. Without
 * `--stdout` the renderer WRITES to disk, next to the manifest it was handed.
 * A test that only exercised the library would never have noticed a change
 * that made it write somewhere else, or write when it was asked not to.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, 'generate-manifest-md.mjs')

function run(args) {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, stdout, stderr: '' }
  } catch (e) {
    return { code: e.status ?? 1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') }
  }
}

const MANIFEST = {
  sandbox: 'SBX-2026-001',
  generatedAt: '2026-09-11T00:00:00.000Z',
  compartments: [
    {
      id: 'pagos',
      kind: 'server-route',
      surface: 'server/api/pagos.ts',
      integrationTarget: 'server/api/',
    },
  ],
}

/** A directory holding one manifest file. */
function withManifest(body = JSON.stringify(MANIFEST, null, 2)) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-manifest-'))
  const file = path.join(root, 'integration-manifest.json')
  fs.writeFileSync(file, body)
  return { root, file, rendered: path.join(root, 'integration-manifest.md') }
}

describe('generate-manifest-md', () => {
  it('exits 1 and prints usage when given no path', () => {
    const r = run([])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /usage:/i)
  })

  it('exits 1 naming the file when it does not parse', () => {
    // The path has to appear in the message: the operator is usually running
    // this over several manifests and "Unexpected token" alone says nothing.
    const { root, file } = withManifest('no soy json {{{')
    const r = run([file])
    assert.equal(r.code, 1)
    assert.match(r.stderr, new RegExp(path.basename(file)))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 when the file does not exist at all', () => {
    const r = run(['/no/existe/integration-manifest.json'])
    assert.equal(r.code, 1)
  })

  it('writes the markdown beside the manifest by default', () => {
    const { root, file, rendered } = withManifest()
    const r = run([file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.equal(fs.existsSync(rendered), true, 'no escribió integration-manifest.md')
    assert.match(r.stdout, /wrote /)
    assert.match(fs.readFileSync(rendered, 'utf8'), /SBX-2026-001/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('writes NOTHING to disk with --stdout', () => {
    // The flag is the difference between previewing a manifest and leaving a
    // file behind in someone's tree.
    const { root, file, rendered } = withManifest()
    const r = run([file, '--stdout'])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /SBX-2026-001/)
    assert.equal(fs.existsSync(rendered), false, '--stdout igual escribió el archivo')
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('does not mistake the flag for the manifest path', () => {
    // `args.find(a => !a.startsWith('--'))` — without it, `--stdout` would be
    // read as the filename and the run would fail on a file nobody named.
    const { root, file } = withManifest()
    const r = run(['--stdout', file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /SBX-2026-001/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
