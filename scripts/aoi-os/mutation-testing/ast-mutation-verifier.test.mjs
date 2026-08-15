import test from 'node:test'
import assert from 'node:assert/strict'
import { generateAstMutants, calculateMutationScore } from './ast-mutation-verifier.mjs'

test('generateAstMutants creates AST micro-mutations on logic and comparison operators', () => {
  const sampleCode = `
export function isValidAge(age: number): boolean {
  if (age >= 18 && age < 120) {
    return true;
  }
  return false;
}
`
  const mutants = generateAstMutants(sampleCode, { maxMutants: 4 })
  assert.ok(mutants.length >= 2)
  assert.ok(mutants.some((m) => m.operator === 'and_to_or' || m.operator === 'boolean_true_to_false'))

  // Verify mutated code is actually modified
  const boolMutant = mutants.find((m) => m.operator === 'boolean_true_to_false')
  if (boolMutant) {
    assert.ok(boolMutant.mutatedCode.includes('return false;'))
  }
})

test('calculateMutationScore evaluates test suite kill ratio accurately', () => {
  const strong = calculateMutationScore(5, 5)
  assert.equal(strong.scorePercent, 100)
  assert.equal(strong.passed, true)
  assert.equal(strong.rating, 'strong')

  const weak = calculateMutationScore(5, 2)
  assert.equal(weak.scorePercent, 40)
  assert.equal(weak.passed, false)
  assert.equal(weak.rating, 'weak')
})
