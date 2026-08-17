import test from 'node:test'
import assert from 'node:assert/strict'
import { auditTempFileCollisionSafety } from './temp-file-collision-guard.mjs'

test('auditTempFileCollisionSafety approves temp file with randomUUID', () => {
  const code = `
function createStagingPath(dir) {
  return path.join(dir, '.tmp-' + crypto.randomUUID() + '.json');
}
`
  const result = auditTempFileCollisionSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.tempFileProof, 'COLLISION_FREE_CSPRNG_TEMP_IDENTIFIER_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditTempFileCollisionSafety detects predictable Date.now() temp file creation', () => {
  const code = `
function createStagingPath(dir) {
  return path.join(dir, '.tmp-' + Date.now() + '.json');
}
`
  const result = auditTempFileCollisionSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.tempFileProof, 'PREDICTABLE_TEMP_FILE_COLLISION_DETECTED')
  assert.equal(result.violationsCount, 1)
})
