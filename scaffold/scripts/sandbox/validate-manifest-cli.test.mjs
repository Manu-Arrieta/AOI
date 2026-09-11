/**
 * scripts/sandbox/validate-manifest-cli.test.mjs
 *
 * `/sdd-verify` wires this script in as a FAIL gate: its exit code decides
 * whether a sandbox manifest is allowed through. Nothing loaded it.
 *
 * The schema behind it is well covered, which is exactly why the wrapper
 * mattered and nobody looked: all three of its exits — missing argument,
 * unparseable file, invalid manifest — go through `process.exitCode` rather
 * than `process.exit`, so a stray `return` or a swallowed error turns a
 * rejection into a silent pass, and a silent pass is a manifest merged into
 * the Owner's project.
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, 'validate-manifest.mjs')

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

const VALID = {
  $schemaVersion: 1,
  sandbox: 'auth-v2',
  generatedAt: '2026-06-15T18:00:00.000Z',
  compartments: [
    {
      id: 'auth-api',
      kind: 'backend',
      surface: 'swagger',
      scope: ['.sandboxes/auth-v2/api'],
      stack: ['nitro'],
      integrationTarget: 'backend:aoi_apps/agentic-ops-dashboard/server',
      chain: ['route/controller', 'service', 'repository', 'data-client'],
      addedInConstitutionVersion: '1.1.0',
    },
  ],
  elements: [
    {
      id: 'auth-route',
      path: '.sandboxes/auth-v2/api/auth.post.ts',
      compartment: 'auth-api',
      kind: 'component',
      disposition: 'integrate',
      target: 'backend:aoi_apps/agentic-ops-dashboard/server/api/auth.post.ts',
      status: 'pending',
      notes: 'n/a',
    },
  ],
}

function withFile(body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-vm-'))
  const file = path.join(root, 'integration-manifest.json')
  fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body, null, 2))
  return { root, file }
}

describe('validate-manifest as /sdd-verify runs it', () => {
  it('exits 1 and prints usage with no argument', () => {
    const r = run([])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /usage:/i)
  })

  it('exits 1 naming the file when it does not parse', () => {
    const { root, file } = withFile('no soy json {{{')
    const r = run([file])
    assert.equal(r.code, 1)
    assert.match(r.stderr, new RegExp(path.basename(file)))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 1 when the file is not there', () => {
    assert.equal(run(['/no/existe/integration-manifest.json']).code, 1)
  })

  it('exits 1 on a manifest the schema rejects, and says why', () => {
    // The gate's whole value is that an invalid manifest cannot pass. The
    // message has to carry the path, because /sdd-verify runs it over several.
    const bad = structuredClone(VALID)
    bad.elements[0].disposition = 'inventada'
    const { root, file } = withFile(bad)
    const r = run([file])
    assert.equal(r.code, 1)
    assert.match(r.stderr, /disposition/)
    assert.match(r.stderr, new RegExp(path.basename(file)))
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('exits 0 on a valid manifest and reports what it counted', () => {
    // The counts are the operator's evidence that the gate read the file it
    // was given rather than an empty one.
    const { root, file } = withFile(VALID)
    const r = run([file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /^OK /)
    assert.match(r.stdout, /1 compartments, 1 elements/)
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('accepts a skeleton manifest with nothing in it yet', () => {
    // A sandbox that has just been created is legitimately empty; failing
    // here would block the phase that creates it.
    const { root, file } = withFile({
      $schemaVersion: 1,
      sandbox: 'nuevo',
      generatedAt: '2026-06-15T18:00:00.000Z',
      compartments: [],
      elements: [],
    })
    const r = run([file])
    assert.equal(r.code, 0, `${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /0 compartments, 0 elements/)
    fs.rmSync(root, { recursive: true, force: true })
  })
})
