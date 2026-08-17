import test from 'node:test'
import assert from 'node:assert/strict'
import { provePrivilegeEscalationSafety } from './sandbox-privilege-escalation-prover.mjs'

test('provePrivilegeEscalationSafety approves standard non-elevated commands', () => {
  const command = 'chmod 755 ./scripts/build.sh && pnpm build'
  const result = provePrivilegeEscalationSafety(command)
  assert.equal(result.safe, true)
  assert.equal(result.escalationProof, 'PRIVILEGE_ESCALATION_CONTAINMENT_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('provePrivilegeEscalationSafety detects dangerous sudo or setuid command', () => {
  const command = 'sudo chmod 4755 /bin/sh'
  const result = provePrivilegeEscalationSafety(command)
  assert.equal(result.safe, false)
  assert.equal(result.escalationProof, 'UNAUTHORIZED_PRIVILEGE_ESCALATION_DETECTED')
  assert.equal(result.violationsCount, 2)
})
