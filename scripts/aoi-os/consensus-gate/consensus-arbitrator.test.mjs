import test from 'node:test'
import assert from 'node:assert/strict'
import {
  auditSecurityInvariants,
  auditArchitecturePrinciples,
  evaluateConsensusGate,
} from './consensus-arbitrator.mjs'

test('auditSecurityInvariants catches hardcoded credentials and dangerous eval', () => {
  const badCode = `
const apiKey = "AIzaSyD-secret-token-12345"
const result = eval("2 + 2")
`
  const audit = auditSecurityInvariants(badCode, 'service.ts')
  assert.equal(audit.passed, false)
  assert.equal(audit.violations.length, 2)
})

test('auditSecurityInvariants passes clean code', () => {
  const cleanCode = `
export function add(a: number, b: number): number {
  return a + b
}
`
  const audit = auditSecurityInvariants(cleanCode, 'math.ts')
  assert.equal(audit.passed, true)
  assert.equal(audit.violations.length, 0)
})

test('auditArchitecturePrinciples checks 300 LOC limit threshold', () => {
  const longCode = Array.from({ length: 350 }, (_, i) => `// Line ${i}`).join('\n')
  const audit = auditArchitecturePrinciples(longCode, 'huge-file.ts', { maxLines: 300 })
  assert.equal(audit.passed, false)
  assert.equal(audit.loc, 350)
  assert.ok(audit.warnings[0].includes('exceeds standard LOC threshold'))
})

test('evaluateConsensusGate approves clean verified code with high score', () => {
  const cleanCode = `
export function getUser(id: string) {
  return { id, name: 'Agent' }
}
`
  const evaluation = evaluateConsensusGate({
    code: cleanCode,
    filePath: 'user.ts',
    testsPassed: true,
    astInvariantSafe: true,
  })

  assert.equal(evaluation.approved, true)
  assert.equal(evaluation.score, 100)
  assert.equal(evaluation.feedback.length, 0)
})

test('evaluateConsensusGate rejects code with security and test failures', () => {
  const riskyCode = `
const password = "my-secret-password-123"
`
  const evaluation = evaluateConsensusGate({
    code: riskyCode,
    filePath: 'auth.ts',
    testsPassed: false,
    astInvariantSafe: false,
  })

  assert.equal(evaluation.approved, false)
  assert.ok(evaluation.score < 85)
  assert.ok(evaluation.feedback.some((f) => f.includes('[SECURITY]')))
  assert.ok(evaluation.feedback.some((f) => f.includes('[TESTS]')))
  assert.ok(evaluation.feedback.some((f) => f.includes('[CONTRACT]')))
})
