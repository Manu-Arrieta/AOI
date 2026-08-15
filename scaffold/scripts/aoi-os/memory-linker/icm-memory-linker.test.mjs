import test from 'node:test'
import assert from 'node:assert/strict'
import {
  generateTaskMemoryPayload,
  buildIcmCliCommands,
  syncTaskToIcm,
} from './icm-memory-linker.mjs'

test('generateTaskMemoryPayload formats structured memories with relations', () => {
  const payload = generateTaskMemoryPayload({
    workspace: 'AOI',
    feature: 'auth',
    taskId: 'T-101',
    taskTitle: 'Build JWT authenticator',
    role: 'backend',
    decisions: ['Use RS256 for asymmetric token signing'],
    resolvedErrors: ['AssertionError on token expiry handling fixed'],
    diffSummary: 'server/auth.ts (+45 lines)',
    dependsOn: ['T-100'],
  })

  assert.equal(payload.workspace, 'AOI')
  assert.equal(payload.taskId, 'T-101')
  assert.equal(payload.memories.length, 3)

  // Verify topics
  const topics = payload.memories.map((m) => m.topic)
  assert.ok(topics.includes('decisions-AOI'))
  assert.ok(topics.includes('errors-resolved'))
  assert.ok(topics.includes('context-AOI'))

  // Verify relations
  const contextMem = payload.memories.find((m) => m.topic === 'context-AOI')
  assert.equal(contextMem.relations.implements, 'T-101')
  assert.deepEqual(contextMem.relations.depends_on, ['T-100'])
})

test('buildIcmCliCommands generates valid ICM CLI store commands', () => {
  const payload = generateTaskMemoryPayload({
    workspace: 'AOI',
    feature: 'core',
    taskId: 'T-1',
    taskTitle: 'Core Init',
    role: 'backend',
    decisions: ['Adopt DAG runner'],
  })

  const commands = buildIcmCliCommands(payload)
  assert.ok(commands.length >= 2)
  assert.ok(commands[0].startsWith('icm store -t "decisions-AOI"'))
  assert.ok(commands[1].startsWith('icm store -t "context-AOI"'))
})

test('syncTaskToIcm executes commands via runner callback', async () => {
  const payload = generateTaskMemoryPayload({
    workspace: 'AOI',
    feature: 'core',
    taskId: 'T-1',
    taskTitle: 'Init',
  })

  const executed = []
  const res = await syncTaskToIcm(payload, async (cmd) => {
    executed.push(cmd)
    return { stdout: 'Stored' }
  })

  assert.equal(res.executedCount, payload.memories.length)
  assert.equal(executed.length, payload.memories.length)
})
