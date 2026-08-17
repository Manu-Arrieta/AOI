import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateHumanGateEscalation } from './human-gate-escalation-guard.mjs'

test('evaluateHumanGateEscalation blocks execution when critical blast radius occurs without human approval', () => {
  const result = evaluateHumanGateEscalation({
    taskId: 'T-101',
    blastRadius: 'critical',
    hasExplicitHumanApproval: false,
  })

  assert.equal(result.escalationRequired, true)
  assert.equal(result.canProceed, false)
  assert.equal(result.gateProof, 'BLOCKED_PENDING_HUMAN_GOVERNOR_APPROVAL')
  assert.ok(result.triggers.includes('CRITICAL_BLAST_RADIUS_DETECTED'))
})

test('evaluateHumanGateEscalation clears execution when human gives explicit approval', () => {
  const result = evaluateHumanGateEscalation({
    taskId: 'T-101',
    blastRadius: 'critical',
    hasExplicitHumanApproval: true,
  })

  assert.equal(result.escalationRequired, true)
  assert.equal(result.canProceed, true)
  assert.equal(result.gateProof, 'HUMAN_OVERRIDE_APPROVED')
})

test('evaluateHumanGateEscalation clears low blast radius tasks automatically', () => {
  const result = evaluateHumanGateEscalation({
    taskId: 'T-102',
    blastRadius: 'low',
    healingAttempts: 0,
  })

  assert.equal(result.escalationRequired, false)
  assert.equal(result.canProceed, true)
  assert.equal(result.gateProof, 'AUTOMATED_EXECUTION_CLEARED')
})
