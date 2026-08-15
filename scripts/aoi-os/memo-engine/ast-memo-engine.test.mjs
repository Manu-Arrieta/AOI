import test from 'node:test'
import assert from 'node:assert/strict'
import { createAstMemoEngine } from './ast-memo-engine.mjs'

test('createAstMemoEngine accurately tracks mutated vs untouched symbols across iterations', () => {
  const engine = createAstMemoEngine()

  const initialCode = `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
  // 1. Initial run: all symbols are new/mutated
  const run1 = engine.diffSymbolCache('math.ts', initialCode)
  assert.equal(run1.mutatedSymbols.length, 2)
  assert.equal(run1.untouchedSymbols.length, 0)
  assert.equal(run1.cacheHitRatio, 0)

  // 2. Second run with unchanged code: 100% cache hit
  const run2 = engine.diffSymbolCache('math.ts', initialCode)
  assert.equal(run2.mutatedSymbols.length, 0)
  assert.equal(run2.untouchedSymbols.length, 2)
  assert.equal(run2.cacheHitRatio, 100)

  // 3. Mutate only add(): multiply() is untouched
  const modifiedCode = `
export function add(a: number, b: number): number {
  return a + b + 0;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
  const run3 = engine.diffSymbolCache('math.ts', modifiedCode)
  assert.deepEqual(run3.mutatedSymbols, ['add'])
  assert.deepEqual(run3.untouchedSymbols, ['multiply'])
  assert.equal(run3.cacheHitRatio, 50)
})
