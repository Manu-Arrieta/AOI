import test from 'node:test'
import assert from 'node:assert/strict'
import { createTokenHologram } from './token-hologram.mjs'

test('createTokenHologram encodes text into compact bitset and performs exact concept queries', () => {
  const docs = [
    'Architecture Rule: Use PostgreSQL for database storage and JWT for authentication.',
    'Domain Invariant: Billing invoices must always include VAT tax.',
  ]

  const hologram = createTokenHologram(docs)
  assert.ok(hologram.totalUniqueTokens >= 10)
  assert.equal(hologram.toHexString().length, 64)

  // Query present concepts
  assert.equal(hologram.containsConcept('postgresql'), true)
  assert.equal(hologram.containsConcept('jwt'), true)
  assert.equal(hologram.containsConcept('invoices'), true)

  // Query absent concepts
  assert.equal(hologram.containsConcept('blockchain'), false)
  assert.equal(hologram.containsConcept('kubernetes'), false)
})
