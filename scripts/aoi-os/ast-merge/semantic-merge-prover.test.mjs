import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSemanticAstMerge } from './semantic-merge-prover.mjs'

test('proveSemanticAstMerge cleanly merges disjoint additions from two agents', () => {
  const base = `export const VERSION = '1.0.0';\n`
  const branchA = `export const VERSION = '1.0.0';\nexport function getStatus() { return 'OK'; }\n`
  const branchB = `export const VERSION = '1.0.0';\nexport function getHealth() { return 'UP'; }\n`

  const result = proveSemanticAstMerge({ baseCode: base, branchACode: branchA, branchBCode: branchB })
  assert.equal(result.success, true)
  assert.equal(result.mergeProof, 'DISJOINT_3WAY_AST_MERGE_PROVEN')
  assert.equal(result.conflictCount, 0)
  assert.ok(result.mergedCode.includes('getStatus'))
  assert.ok(result.mergedCode.includes('getHealth'))
})

test('proveSemanticAstMerge detects collisions when both agents introduce the same symbol', () => {
  const base = `export const VERSION = '1.0.0';\n`
  const branchA = `export const VERSION = '1.0.0';\nexport function getStatus() { return 'A'; }\n`
  const branchB = `export const VERSION = '1.0.0';\nexport function getStatus() { return 'B'; }\n`

  const result = proveSemanticAstMerge({ baseCode: base, branchACode: branchA, branchBCode: branchB })
  assert.equal(result.success, false)
  assert.equal(result.mergeProof, 'SEMANTIC_MERGE_COLLISION_DETECTED')
  assert.equal(result.conflictCount, 1)
  assert.equal(result.conflicts[0].symbol, 'getStatus')
})
