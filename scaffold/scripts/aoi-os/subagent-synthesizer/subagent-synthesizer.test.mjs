import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveToolCapabilityWhitelist,
  synthesizeMicroAgent,
} from './subagent-synthesizer.mjs'

test('resolveToolCapabilityWhitelist restricts tools per role', () => {
  const feTools = resolveToolCapabilityWhitelist('frontend')
  assert.ok(feTools.includes('replace_file_content'))
  assert.ok(feTools.includes('run_command'))

  const qaTools = resolveToolCapabilityWhitelist('qa')
  assert.ok(!qaTools.includes('replace_file_content'))
  assert.ok(qaTools.includes('run_command'))
})

test('synthesizeMicroAgent creates compact scoped prompt payload', () => {
  const dagNode = {
    id: 'T-1',
    title: 'Task T-1: Build Auth API endpoint',
    role: 'backend',
    targetFiles: ['server/api/auth.ts'],
    testRequirements: 'Unit test JWT generation with 200 OK',
    metadata: { rawBlock: '### Task T-1: Build Auth API endpoint [backend]' },
  }

  const microAgent = synthesizeMicroAgent({
    dagNode,
    workspace: 'AOI',
    feature: 'auth-flow',
    taskId: 'TASK-2026-005',
    constitutionRules: 'No unhandled promises. Export typed interfaces.',
  })

  assert.equal(microAgent.agentId, 'micro-backend-t-1')
  assert.equal(microAgent.role, 'backend')
  assert.ok(microAgent.systemPrompt.includes('ROLE: @backend-micro-worker'))
  assert.ok(microAgent.systemPrompt.includes('server/api/auth.ts'))
  assert.ok(microAgent.systemPrompt.includes('No unhandled promises'))

  assert.ok(microAgent.taskPrompt.includes('Feature: auth-flow'))
  assert.ok(microAgent.taskPrompt.includes('Unit test JWT generation'))
  assert.equal(microAgent.tokenBudget, 2500)
})
