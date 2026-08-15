import test from 'node:test'
import assert from 'node:assert/strict'
import { proposeAstRefactoring } from './self-refactoring-kernel.mjs'

test('proposeAstRefactoring detects complex nested structures and generates sub-function proposals', () => {
  const complexCode = `
export function megaProcessor(data: any) {
  if (data.type === 'BILLING') {
    const total = data.items.reduce((a: number, b: any) => a + b.price, 0);
    const tax = total * 0.19;
    const finalAmount = total + tax;
    return { total, tax, finalAmount };
  }
  if (data.type === 'AUTH') {
    const token = data.headers.authorization;
    const isValid = token && token.startsWith('Bearer ');
    return { isValid, user: data.user };
  }
  return null;
}
`
  const result = proposeAstRefactoring(complexCode, { maxAllowedComplexity: 2 })
  assert.equal(result.needsRefactor, true)
  assert.equal(result.refactorStatus, 'MODULAR_EXTRACTION_RECOMMENDED')
  assert.ok(result.totalProposals >= 1)
  assert.ok(result.proposals.some((p) => p.name.startsWith('handleSubCondition_')))
})

test('proposeAstRefactoring passes simple pure functions without refactor recommendation', () => {
  const simpleCode = `
export function add(a: number, b: number): number {
  return a + b;
}
`
  const result = proposeAstRefactoring(simpleCode)
  assert.equal(result.needsRefactor, false)
  assert.equal(result.refactorStatus, 'COMPLEXITY_OPTIMAL')
})
