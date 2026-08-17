import test from 'node:test'
import assert from 'node:assert/strict'
import { auditPiiMaskingSafety } from './pii-masking-guard.mjs'

test('auditPiiMaskingSafety approves logging with masked secrets', () => {
  const code = `
function logUserAuth(user, password) {
  logger.info({ user: user.id, password: maskSecret(password) });
}
`
  const result = auditPiiMaskingSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.piiProof, 'SENSITIVE_DATA_LOGGING_MASKED')
  assert.equal(result.violationsCount, 0)
})

test('auditPiiMaskingSafety detects unguarded logging of passwords', () => {
  const code = `
function logUserAuth(user, password) {
  logger.info({ user: user.id, password });
}
`
  const result = auditPiiMaskingSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.piiProof, 'UNMASKED_PII_LOGGING_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
