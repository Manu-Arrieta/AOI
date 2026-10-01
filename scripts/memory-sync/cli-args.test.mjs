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
import { UsageError } from '../sdd-lifecycle/cli-flags.mjs'

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

  it('refuses a flag with no value instead of reading it as "none selected"', () => {
    // Before: `--scope` at the end was skipped, the list stayed empty, and the
    // export read an empty list as ALL scopes.
    assert.throws(() => parseBundleArgs(['ws', 'v1', 'a.gz', '--scope'], { lists: ['scope'] }), UsageError)
  })

  it('refuses to take the next option as a value, instead of swallowing or skipping it', () => {
    assert.throws(
      () => parseBundleArgs(['ws', 'v1', 'a.gz', '--scope', '--versions-root', '/raiz'], { lists: ['scope'] }),
      UsageError,
    )
  })

  it('refuses an unknown flag and names the valid ones — `--scopes` exported everything', () => {
    // Medido (D4): `--scopes memories` dejaba `scope` vacío y el export tomaba
    // la lista vacía como "todos": un typo de una letra exportaba la memoria entera.
    assert.throws(
      () => parseBundleArgs(['ws', 'v1', 'a.gz', '--scopes', 'memories'], { lists: ['scope'] }),
      (e) => e instanceof UsageError && /--scopes/.test(e.message) && /--scope <valor>/.test(e.message),
    )
  })

  it('refuses a list flag the calling CLI did not declare', () => {
    // `--retain` is import's; on export it would have been accepted and ignored.
    assert.throws(() => parseBundleArgs(['ws', 'v1', 'a.gz', '--retain', 'x'], { lists: ['scope'] }), UsageError)
  })

  it('refuses a stray token after the three positionals', () => {
    assert.throws(
      () => parseBundleArgs(['ws', 'v1', 'a.gz', 'suelto', '--versions-root', '/raiz']),
      (e) => e instanceof UsageError && /suelto/.test(e.message),
    )
  })

  it('reads the positionals even when a flag comes first', () => {
    const r = parseBundleArgs(['--versions-root', '/raiz', 'ws', 'v1', 'a.gz'])
    assert.deepEqual([r.workspace, r.versionId, r.relativeArtifactPath], ['ws', 'v1', 'a.gz'])
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
