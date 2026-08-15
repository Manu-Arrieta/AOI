import test from 'node:test'
import assert from 'node:assert/strict'
import { proveTestInvariants } from './mutation-invariant-prover.mjs'

test('proveTestInvariants approves tests with proper assertions', () => {
  const code = `
test('calculates sum correctly', () => {
  const res = 1 + 2;
  assert.equal(res, 3);
});
`
  const result = proveTestInvariants(code)
  assert.equal(result.valid, true)
  assert.equal(result.invariantProof, 'ALL_TESTS_CONTAIN_INVARIANT_ASSERTIONS')
  assert.equal(result.totalTests, 1)
  assert.equal(result.shallowTestsCount, 0)
})

test('proveTestInvariants detects assertionless shallow tests', () => {
  const code = `
test('runs without throwing', () => {
  const a = 1;
  const b = 2;
});
`
  const result = proveTestInvariants(code)
  assert.equal(result.valid, false)
  assert.equal(result.invariantProof, 'SHALLOW_ASSERTIONLESS_TESTS_DETECTED')
  assert.equal(result.shallowTestsCount, 1)
})
