/**
 * scripts/sandbox/manifest-schema-guards.test.mjs
 *
 * The rejections, not the acceptances.
 *
 * `validate-manifest.test.mjs` already checks that a good manifest is
 * accepted and that a handful of bad ones are refused. The mutation probe
 * showed what was left: fourteen guards inside the schema helpers could be
 * inverted and nothing noticed, because no test ever handed them the shape
 * they exist to catch.
 *
 * That matters here specifically. The integration manifest is what decides
 * which sandbox files get merged into the Owner's project and where they
 * land. A validator exercised only with valid input is not a validator — it
 * is a pass-through with a comment, and the first malformed manifest is the
 * one that finds out.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateManifest } from './manifest-schema.mjs'

/** A manifest that validates, so each case can break exactly one thing. */
function good() {
  return {
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
}

const rejects = (manifest, pattern) => assert.throws(() => validateManifest(manifest), pattern)

describe('the manifest itself must be a plain object', () => {
  // `typeof value === 'object' && value !== null && !Array.isArray(value)` —
  // three conditions, and each one alone is what rules out a different shape.
  for (const [what, value] of [
    ['null', null],
    ['an array', []],
    ['a string', 'manifest'],
    ['a number', 7],
    ['undefined', undefined],
  ]) {
    it(`rejects ${what}`, () => rejects(value, /must be an object/))
  }
})

describe('the schema version is pinned, not merely present', () => {
  for (const [what, version] of [
    ['a newer version', 2],
    ['the string "1"', '1'],
    ['a missing version', undefined],
  ]) {
    it(`rejects ${what}`, () => {
      const m = good()
      if (version === undefined) delete m.$schemaVersion
      else m.$schemaVersion = version
      rejects(m, /\$schemaVersion must be 1/)
    })
  }
})

describe('a required string must carry content, not just be a string', () => {
  // `value.trim().length > 0` — an empty or blank name passes `typeof` and
  // then produces a manifest whose sandbox has no name.
  for (const [what, value] of [['empty', ''], ['only spaces', '   '], ['a newline', '\n']]) {
    it(`rejects a sandbox name that is ${what}`, () => {
      const m = good()
      m.sandbox = value
      rejects(m, /sandbox must be a non-empty string/)
    })
  }
})

describe('generatedAt must actually parse as a date', () => {
  it('rejects a string that is not a date', () => {
    const m = good()
    m.generatedAt = 'el martes pasado'
    rejects(m, /valid ISO date/)
  })

  it('rejects an empty date before trying to parse it', () => {
    const m = good()
    m.generatedAt = ''
    rejects(m, /non-empty string/)
  })

  it('accepts a real ISO timestamp', () => {
    const m = good()
    m.generatedAt = '2027-01-01T00:00:00.000Z'
    assert.doesNotThrow(() => validateManifest(m))
  })
})

describe('compartments and elements must be arrays', () => {
  for (const field of ['compartments', 'elements']) {
    it(`rejects ${field} given as an object`, () => {
      const m = good()
      m[field] = {}
      rejects(m, new RegExp(`${field} must be an array`))
    })
  }
})

describe('the backend chain is required, and forbidden elsewhere', () => {
  // `raw.kind === "backend"` decides which of two opposite rules applies, so
  // inverting it makes the schema demand a chain from the wrong half.
  it('rejects a backend compartment with an empty chain', () => {
    const m = good()
    m.compartments[0].chain = []
    rejects(m, /chain must be a non-empty array/)
  })

  it('rejects a backend compartment with no chain at all', () => {
    const m = good()
    delete m.compartments[0].chain
    rejects(m, /chain/)
  })

  it('accepts a non-backend compartment without a chain', () => {
    const m = good()
    Object.assign(m.compartments[0], {
      kind: 'docs',
      surface: 'none',
      integrationTarget: 'visualization-only',
    })
    delete m.compartments[0].chain
    m.elements[0].target = 'visualization-only'
    assert.doesNotThrow(() => validateManifest(m))
  })
})

describe('a target token names a root key and a path', () => {
  // `separatorIndex > 0` and `rest.trim().length > 0` are the two halves of
  // "{rootKey}:{path}". Either one inverted accepts a token that names only
  // half a destination — and the destination is where files get written.
  for (const [what, token, pattern] of [
    ['no separator', 'backend', /visualization-only/],
    ['a separator at the start', ':ruta/al/archivo', /visualization-only/],
    ['nothing after the separator', 'backend:', /must include a path/],
    ['only spaces after the separator', 'backend:   ', /must include a path/],
    ['an unknown root key', 'infraestructura:ruta', /unknown root key/],
  ]) {
    it(`rejects a target with ${what}`, () => {
      const m = good()
      m.elements[0].target = token
      rejects(m, pattern)
    })
  }

  it('accepts the visualization-only sentinel', () => {
    const m = good()
    m.elements[0].target = 'visualization-only'
    assert.doesNotThrow(() => validateManifest(m))
  })

  it("accepts a null target on an element, which is where null IS allowed", () => {
    // The two call sites differ on purpose: an element may be
    // visualization-only and carry no destination, a compartment may not.
    const m = good()
    m.elements[0].target = null
    assert.doesNotThrow(() => validateManifest(m))
  })

  it('rejects a null integrationTarget on a compartment, where it is not', () => {
    const m = good()
    m.compartments[0].integrationTarget = null
    rejects(m, /must not be null/)
  })
})

describe('a string array rejects a non-string member', () => {
  it('rejects a number inside stack', () => {
    const m = good()
    m.compartments[0].stack = ['nitro', 7]
    rejects(m, /stack\[\] must be a non-empty string/)
  })

  it('rejects an empty string inside scope', () => {
    const m = good()
    m.compartments[0].scope = ['']
    rejects(m, /scope\[\]/)
  })

  it('rejects scope given as a bare string instead of an array', () => {
    const m = good()
    m.compartments[0].scope = '.sandboxes/auth-v2/api'
    rejects(m, /must be an array/)
  })
})
