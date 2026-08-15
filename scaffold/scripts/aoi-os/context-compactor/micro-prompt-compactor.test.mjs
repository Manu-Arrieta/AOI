import test from 'node:test'
import assert from 'node:assert/strict'
import { compactContextPayload } from './micro-prompt-compactor.mjs'

test('compactContextPayload strips comments and excessive whitespace while preserving code semantics', () => {
  const verboseCode = `
/**
 * Detailed documentation that burns prompt tokens unnecessarily
 * @param a First number
 * @param b Second number
 */
export function add(a: number, b: number): number {
  // Inline comment here
  return a + b; // return sum
}

`
  const result = compactContextPayload(verboseCode)
  assert.ok(result.savingsPct >= 30)
  assert.equal(result.densityRating, 'HIGH_DENSITY_PAYLOAD')
  assert.ok(result.compacted.includes('export function add(a: number, b: number): number {'))
  assert.ok(!result.compacted.includes('Detailed documentation'))
  assert.ok(!result.compacted.includes('Inline comment here'))
})
