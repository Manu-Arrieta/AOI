import test from 'node:test'
import assert from 'node:assert/strict'
import { createCapabilityToken, enforceCapability } from './capability-enforcer.mjs'

test('createCapabilityToken creates deterministic cryptographic token', () => {
  const token = createCapabilityToken({
    taskId: 'T-1',
    role: 'backend',
    allowedFiles: ['server/api/tasks.ts'],
    allowedTools: ['view_file', 'replace_file_content'],
  })

  assert.equal(token.signature.length, 64)
  assert.equal(token.taskId, 'T-1')
})

test('enforceCapability authorizes valid actions and vetoes unauthorized access', () => {
  const token = createCapabilityToken({
    taskId: 'T-1',
    role: 'backend',
    allowedFiles: ['server/api/tasks.ts'],
    allowedTools: ['view_file', 'replace_file_content'],
  })

  // Allowed file
  const authFile = enforceCapability(token, { operation: 'MUTATE_FILE', target: 'server/api/tasks.ts' })
  assert.equal(authFile.authorized, true)
  assert.equal(authFile.enforcementProof, 'CAPABILITY_ENFORCEMENT_AUTHORIZED')

  // Unauthorized file mutation
  const vetoFile = enforceCapability(token, { operation: 'MUTATE_FILE', target: 'sensitive/secrets.env' })
  assert.equal(vetoFile.authorized, false)
  assert.equal(vetoFile.enforcementProof, 'CAPABILITY_ENFORCEMENT_VETO')

  // Unauthorized tool execution
  const vetoTool = enforceCapability(token, { operation: 'EXEC_TOOL', target: 'drop_database' })
  assert.equal(vetoTool.authorized, false)
})
