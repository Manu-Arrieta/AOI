import test from 'node:test'
import assert from 'node:assert/strict'
import { optimizeAstRepresentation } from './ast-inliner.mjs'

test('optimizeAstRepresentation detects pass-through wrappers and intermediate return variables', () => {
  const code = `
function wrapAdd(x) { return rawAdd(x); }

export function calc(a: number) {
  const temp = a * 2;
  return temp;
}
`
  const result = optimizeAstRepresentation(code)
  assert.equal(result.isOptimal, false)
  assert.equal(result.totalOptimizations, 2)
  assert.ok(result.optimizations.some((o) => o.type === 'PASS_THROUGH_WRAPPER_INLINE'))
  assert.ok(result.optimizations.some((o) => o.type === 'REDUNDANT_TEMP_RETURN_ELIMINATION'))
})

test('optimizeAstRepresentation passes already optimal code with score 100', () => {
  const optimalCode = `
export function pureAdd(a: number, b: number): number {
  return a + b;
}
`
  const result = optimizeAstRepresentation(optimalCode)
  assert.equal(result.isOptimal, true)
  assert.equal(result.cleanCodeScore, 100)
  assert.equal(result.totalOptimizations, 0)
})
