import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSymbolicConstraints } from './symbolic-constraint-prover.mjs'

test('proveSymbolicConstraints proves satisfiable guarded functions', () => {
  const code = `
export function divide(a: number, b: number): number {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
}
`
  const proof = proveSymbolicConstraints(code, 'divide')
  assert.equal(proof.satisfiable, true)
  assert.ok(proof.invariantsProven >= 1)
  assert.equal(proof.contradictions.length, 0)
})

test('proveSymbolicConstraints catches impossible mathematical contradictions', () => {
  const impossibleCode = `
export function validate(score: number) {
  if (score > 100 && score < 50) {
    return true;
  }
  return false;
}
`
  const proof = proveSymbolicConstraints(impossibleCode, 'validate')
  assert.equal(proof.satisfiable, false)
  assert.equal(proof.contradictions.length, 1)
  assert.equal(proof.contradictions[0].type, 'unsatisfiable_range')
})
