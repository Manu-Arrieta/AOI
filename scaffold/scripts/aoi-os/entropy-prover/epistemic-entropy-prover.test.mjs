import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateShannonEntropy, proveEpistemicEntropy } from './epistemic-entropy-prover.mjs'

test('calculateShannonEntropy accurately computes entropy for uniform and diverse strings', () => {
  assert.equal(calculateShannonEntropy(''), 0)
  assert.equal(calculateShannonEntropy('aaaa'), 0) // Single char -> 0 bits of entropy
  assert.ok(calculateShannonEntropy('abcdefg') > 2.5) // Higher diversity -> higher entropy
})

test('proveEpistemicEntropy verifies cognitive stability between code iterations', () => {
  const prevCode = 'export function add(a: number, b: number): number { return a + b; }'
  const currCode = 'export const add = (a: number, b: number): number => a + b;'

  const result = proveEpistemicEntropy(prevCode, currCode)
  assert.equal(result.isSimplifiedOrStable, true)
  assert.equal(result.entropyStatus, 'COGNITIVE_ENTROPY_OPTIMAL')
})
