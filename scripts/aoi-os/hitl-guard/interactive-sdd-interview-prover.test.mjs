import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSddInterviewClarification } from './interactive-sdd-interview-prover.mjs'

test('auditSddInterviewClarification passes clean unambiguous user stories', () => {
  const text = `
Feature: User Authentication
- The endpoint must validate JWT signatures with RS256
- Session expiration is set to 3600 seconds
`
  const result = auditSddInterviewClarification(text)
  assert.equal(result.valid, true)
  assert.equal(result.requiresClarification, false)
  assert.equal(result.clarificationProof, 'INTENT_SPECIFICATION_FULLY_DETERMINISTIC')
  assert.equal(result.ambiguityCount, 0)
})

test('auditSddInterviewClarification flags ambiguous terms when no human response provided', () => {
  const text = `
Feature: Payment Processing
- Maybe support PayPal later
- Database schema is TBD
`
  const result = auditSddInterviewClarification(text, { hasHumanClarificationResponse: false })
  assert.equal(result.valid, false)
  assert.equal(result.requiresClarification, true)
  assert.equal(result.clarificationProof, 'MANDATORY_INTERACTIVE_HUMAN_INTERVIEW_REQUIRED')
  assert.equal(result.ambiguityCount, 2)
})

test('auditSddInterviewClarification approves ambiguous terms once human explicitly resolves them', () => {
  const text = `
Feature: Payment Processing
- Database schema is TBD
`
  const result = auditSddInterviewClarification(text, { hasHumanClarificationResponse: true })
  assert.equal(result.valid, true)
  assert.equal(result.requiresClarification, false)
  assert.equal(result.clarificationProof, 'HUMAN_CLARIFICATION_RESOLVED')
})
