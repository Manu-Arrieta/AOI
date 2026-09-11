/**
 * scripts/memory-sync/cli-args.test.mjs
 *
 * The parser both bundle CLIs now share, and that neither had before.
 *
 * The two files had written the same fifty-line loop twice with different
 * flag names, and the mutation probe planted a mutant in every branch of
 * both: not one was killed. A misparse here does not crash — it silently
 * exports the wrong scopes, writes to the wrong root, or drops a decision.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseBundleArgs } from './cli-args.mjs'

describe('parseBundleArgs', () => {
  it('takes the first three tokens as the positional values', () => {
    const r = parseBundleArgs(['ws', 'v1', 'a.memory-bundle.json.gz'])
    assert.equal(r.workspace, 'ws')
    assert.equal(r.versionId, 'v1')
    assert.equal(r.relativeArtifactPath, 'a.memory-bundle.json.gz')
  })

  it('leaves missing positionals undefined rather than shifting the flags up', () => {
    const r = parseBundleArgs(['ws'])
    assert.equal(r.workspace, 'ws')
    assert.equal(r.versionId, undefined)
    assert.equal(r.relativeArtifactPath, undefined)
  })

  it('reads a scalar flag and does not treat its value as the next flag', () => {
    // The `index += 1` after a match. Without it the value is re-examined on
    // the next pass, which is harmless for a path but not for a list.
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', '--versions-root', '/raiz', '--exports-root', '/exp'])
    assert.equal(r.flags['versions-root'], '/raiz')
    assert.equal(r.flags['exports-root'], '/exp')
  })

  it('accumulates a repeated list flag in order', () => {
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', '--scope', 'memories', '--scope', 'memoir'], {
      lists: ['scope'],
    })
    assert.deepEqual(r.flags.scope, ['memories', 'memoir'])
  })

  it('gives a declared list flag an empty array when it never appears', () => {
    // Callers spread these straight into a payload; `undefined` would become
    // a missing field rather than an explicit "none selected".
    const r = parseBundleArgs(['ws', 'v1', 'a.gz'], { lists: ['scope', 'retain'] })
    assert.deepEqual(r.flags.scope, [])
    assert.deepEqual(r.flags.retain, [])
  })

  it('keeps the last value of a repeated scalar flag', () => {
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', '--versions-root', '/uno', '--versions-root', '/dos'])
    assert.equal(r.flags['versions-root'], '/dos')
  })

  it('ignores a flag with no value instead of recording undefined', () => {
    // A scope list with a hole in it fails downstream complaining about the
    // hole, which sends the operator looking in the wrong place.
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', '--scope'], { lists: ['scope'] })
    assert.deepEqual(r.flags.scope, [])
  })

  it('does not swallow the next option as a value', () => {
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', '--scope', '--versions-root', '/raiz'], {
      lists: ['scope'],
    })
    assert.deepEqual(r.flags.scope, [], '`--versions-root` se consumió como si fuera un scope')
    assert.equal(r.flags['versions-root'], '/raiz')
  })

  it('ignores a bare token that is not a flag', () => {
    const r = parseBundleArgs(['ws', 'v1', 'a.gz', 'suelto', '--versions-root', '/raiz'])
    assert.equal(r.flags.suelto, undefined)
    assert.equal(r.flags['versions-root'], '/raiz')
  })

  it('handles an empty argv', () => {
    const r = parseBundleArgs([])
    assert.equal(r.workspace, undefined)
    assert.deepEqual(r.flags, {})
  })

  it('separates the list namespace per call, so two CLIs do not share state', () => {
    const a = parseBundleArgs(['ws', 'v1', 'a.gz', '--scope', 'memories'], { lists: ['scope'] })
    const b = parseBundleArgs(['ws', 'v1', 'a.gz'], { lists: ['scope'] })
    assert.deepEqual(a.flags.scope, ['memories'])
    assert.deepEqual(b.flags.scope, [])
  })
})
