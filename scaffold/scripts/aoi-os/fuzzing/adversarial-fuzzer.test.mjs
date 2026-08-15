import test from 'node:test'
import assert from 'node:assert/strict'
import { generateAdversarialVectors, EDGE_CASE_VECTORS } from './adversarial-fuzzer.mjs'

test('generateAdversarialVectors generates boundary test vectors for string and number types', () => {
  const params = [
    { name: 'username', type: 'string' },
    { name: 'age', type: 'number' },
  ]

  const suite = generateAdversarialVectors(params, { functionName: 'registerUser' })
  assert.equal(suite.functionName, 'registerUser')
  assert.ok(suite.testCasesCount >= 8)

  // Verify probes present
  const hasEmptyString = suite.testVectors.some((v) => v.username === '')
  const hasZeroOrNegative = suite.testVectors.some((v) => v.age === 0 || v.age === -1)
  assert.ok(hasEmptyString)
  assert.ok(hasZeroOrNegative)
})

test('generateAdversarialVectors handles empty parameters gracefully', () => {
  const suite = generateAdversarialVectors([], { functionName: 'noop' })
  assert.equal(suite.testCasesCount, 0)
  assert.equal(suite.testVectors.length, 0)
})
