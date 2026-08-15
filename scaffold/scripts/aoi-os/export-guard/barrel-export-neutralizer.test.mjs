import test from 'node:test'
import assert from 'node:assert/strict'
import { auditBarrelExports } from './barrel-export-neutralizer.mjs'

test('auditBarrelExports approves clean explicit named re-exports', () => {
  const code = `
export { parseTaskDag } from './dag-parser.mjs';
export { validateDagStructure } from './dag-scheduler.mjs';
`
  const result = auditBarrelExports(code)
  assert.equal(result.clean, true)
  assert.equal(result.barrelProof, 'EXPLICIT_BARREL_EXPORTS_PROVEN')
  assert.equal(result.wildcardCount, 0)
})

test('auditBarrelExports detects dangerous wildcard re-exports', () => {
  const code = `
export * from './dag-parser.mjs';
`
  const result = auditBarrelExports(code)
  assert.equal(result.clean, false)
  assert.equal(result.barrelProof, 'WILDCARD_STAR_EXPORTS_DETECTED')
  assert.equal(result.wildcardCount, 1)
})
