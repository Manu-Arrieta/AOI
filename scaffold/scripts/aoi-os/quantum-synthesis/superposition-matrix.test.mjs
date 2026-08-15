import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSuperpositionBranches } from './superposition-matrix.mjs'

test('evaluateSuperpositionBranches selects clean, low-complexity candidate over convoluted branch', () => {
  const candidates = [
    {
      id: 'branch-convoluted',
      name: 'Convoluted Nested Imperative',
      code: `
export function processTask(id: string, status: string, count: number) {
  let result = null;
  if (status === 'A') {
    if (count > 10) {
      if (id !== '') {
        result = 1;
      } else {
        result = 2;
      }
    } else {
      result = 3;
    }
  } else {
    result = 4;
  }
  return result;
}
`,
    },
    {
      id: 'branch-clean',
      name: 'Clean Functional Composition',
      code: `
export function processTask(id: string, status: string, count: number): number {
  if (status !== 'A') return 4;
  if (count <= 10) return 3;
  return id ? 1 : 2;
}
`,
    },
  ]

  const outcome = evaluateSuperpositionBranches(candidates)
  assert.equal(outcome.totalBranchesEvaluated, 2)
  assert.equal(outcome.winner.id, 'branch-clean')
  assert.ok(outcome.winner.fitnessScore > outcome.matrix[1].fitnessScore)
})
