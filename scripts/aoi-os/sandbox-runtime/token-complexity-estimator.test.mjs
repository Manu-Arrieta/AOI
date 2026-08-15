import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateTokenComplexity } from './token-complexity-estimator.mjs'

test('estimateTokenComplexity evaluates low complexity snippets accurately', () => {
  const code = `
export function add(a: number, b: number): number {
  return a + b;
}
`
  const result = estimateTokenComplexity(code, 'math.ts')
  assert.equal(result.cyclomaticComplexity, 1)
  assert.equal(result.complexityRating, 'low')
  assert.equal(result.recommendation, 'direct')
  assert.ok(result.totalEstimatedTokens < 1000)
})

test('estimateTokenComplexity detects high/extreme complexity and recommends atomic split', () => {
  const branches = Array.from({ length: 35 }, (_, i) => `  if (x === ${i}) { return ${i}; }`).join('\n')
  const complexCode = `
export function complexRouter(x: number) {
${branches}
  return -1;
}
`
  const result = estimateTokenComplexity(complexCode, 'router.ts')
  assert.ok(result.cyclomaticComplexity > 30)
  assert.equal(result.complexityRating, 'extreme')
  assert.equal(result.recommendation, 'split_atomic')
})
