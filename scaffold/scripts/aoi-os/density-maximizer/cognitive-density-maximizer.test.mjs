import test from 'node:test'
import assert from 'node:assert/strict'
import { maximizeCognitiveDensity } from './cognitive-density-maximizer.mjs'

test('maximizeCognitiveDensity compresses conversational filler into dense symbolic directives', () => {
  const verbose = 'Please make sure to export all interfaces and under no circumstances should you use any.'
  const result = maximizeCognitiveDensity(verbose)

  assert.ok(result.tokenReductionPct > 10)
  assert.equal(result.signalDensityPct, 98)
  assert.equal(result.maximizerProof, 'MAXIMUM_COGNITIVE_SIGNAL_DENSITY')
  assert.ok(result.condensedDirectives.includes('MUST: export all interfaces'))
  assert.ok(result.condensedDirectives.includes('NEVER: use any'))
})
