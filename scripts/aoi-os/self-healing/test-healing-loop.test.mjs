import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractFailureDiagnostic,
  createSelfHealingSession,
} from './test-healing-loop.mjs'

test('extractFailureDiagnostic parses failing assertion and stack trace', () => {
  const sampleVitestOutput = `
FAIL test/server/auth.test.ts > authenticateUser
AssertionError: Expected 200 to strictly equal 401
  at TestContext.<anonymous> (test/server/auth.test.ts:45:12)
  at runTest (vitest/runner.js:12:4)
`

  const diag = extractFailureDiagnostic(sampleVitestOutput)
  assert.equal(diag.failed, true)
  assert.ok(diag.testName.includes('authenticateUser'))
  assert.ok(diag.errorMessage.includes('AssertionError: Expected 200 to strictly equal 401'))
  assert.ok(diag.stackSnippet.includes('test/server/auth.test.ts:45:12'))
})

test('createSelfHealingSession manages retry budget and generates fix prompt', () => {
  const session = createSelfHealingSession({
    taskId: 'TASK-2026-003',
    role: 'backend',
    targetFile: 'server/api/auth.ts',
    maxRetries: 2,
  })

  assert.equal(session.getState(), 'active')
  assert.equal(session.getAttempts(), 0)

  // Attempt 1: Record first failure
  const fail1 = session.recordFailure(
    'AssertionError: Expected token to be defined\n  at auth.test.ts:12:4',
    '+ const token = null'
  )
  assert.equal(fail1.attemptCount, 1)
  assert.equal(fail1.isCircuitBreakerTripped, false)
  assert.ok(fail1.fixPrompt.includes('Attempt 1/2'))
  assert.ok(fail1.fixPrompt.includes('server/api/auth.ts'))
  assert.ok(fail1.fixPrompt.includes('+ const token = null'))

  // Attempt 2: Record second failure with hyperCompressed mode -> Tripping circuit breaker
  const fail2 = session.recordFailure(
    'AssertionError: Expected token to be defined\n  at auth.test.ts:12:4',
    '',
    true
  )
  assert.equal(fail2.attemptCount, 2)
  assert.equal(fail2.state, 'tripped')
  assert.ok(fail2.fixPrompt.includes('=== SURGICAL FIX (Attempt 2/2) ==='))
  assert.ok(fail2.fixPrompt.includes('0 prose, return code edit only.'))
})

test('executeCircuitBreakerRollback executes rollback handler and formats report', async () => {
  const session = createSelfHealingSession({
    taskId: 'TASK-2026-003',
    role: 'backend',
    maxRetries: 1,
  })

  session.recordFailure('AssertionError: failed')
  assert.equal(session.getState(), 'tripped')

  let rollbackCalled = false
  const res = await session.executeCircuitBreakerRollback(async () => {
    rollbackCalled = true
    return { rolledBackTo: 'v1.2.0' }
  })

  assert.equal(rollbackCalled, true)
  assert.equal(res.tripped, true)
  assert.ok(res.escalationReport.includes('CIRCUIT BREAKER TRIPPED'))
  assert.ok(res.escalationReport.includes('TASK-2026-003'))
})
