import test from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeTasksToTOON,
  serializeContractsToTOON,
  serializeRelationsToTOON,
  serializeSubagentPayloadToTOON,
} from './toon-serializer.mjs'

test('serializeTasksToTOON encodes tasks in compact tabular notation', () => {
  const sampleTasks = [
    { id: 'T-1', status: 'completed', title: 'Setup Store', content: 'Init Pinia store' },
    { id: 'T-2', status: 'pending', title: 'Build UI', content: 'Create TaskBoard.vue' },
  ]

  const result = serializeTasksToTOON(sampleTasks)
  assert.ok(result.includes('::TASKS[id|status|title]::'))
  assert.ok(result.includes('|T-1|completed|Setup Store|'))
  assert.ok(result.includes('|T-2|pending|Build UI|'))
  assert.ok(result.includes('↳ details: Create TaskBoard.vue'))
})

test('serializeTasksToTOON handles empty task array', () => {
  assert.equal(serializeTasksToTOON([]), '::TASKS[empty]::')
})

test('serializeContractsToTOON wraps contracts cleanly', () => {
  const contracts = 'export interface User { id: string }'
  const result = serializeContractsToTOON(contracts)
  assert.ok(result.startsWith('::CONTRACTS::'))
  assert.ok(result.includes('export interface User { id: string }'))
  assert.ok(result.endsWith('::END_CONTRACTS::'))
})

test('serializeRelationsToTOON encodes relations into table', () => {
  const relations = [
    { kind: 'userstory', targetPath: '.resources/US-1.md', description: 'Auth story' },
  ]
  const result = serializeRelationsToTOON(relations)
  assert.ok(result.includes('::RELATIONS[kind|path|desc]::'))
  assert.ok(result.includes('|userstory|.resources/US-1.md|Auth story|'))
})

test('serializeSubagentPayloadToTOON builds complete envelope', () => {
  const result = serializeSubagentPayloadToTOON({
    taskId: 'TASK-100',
    feature: 'token-opt',
    workspace: 'AOI',
    role: 'backend',
    tasks: [{ id: 'T-10', status: 'pending', title: 'Create API' }],
    contracts: 'export interface ApiResponse {}',
    relations: [{ kind: 'spec', targetPath: 'spec.md' }],
  })

  assert.ok(result.includes('::AOI_SUBAGENT_PAYLOAD[v2]::'))
  assert.ok(result.includes('META: ws=AOI feat=token-opt task=TASK-100 role=@backend'))
  assert.ok(result.includes('|T-10|pending|Create API|'))
  assert.ok(result.includes('::CONTRACTS::'))
  assert.ok(result.includes('export interface ApiResponse {}'))
  assert.ok(result.includes('::GATES:: TDD=RED->GREEN->REFACTOR'))
  assert.ok(result.includes('::END_PAYLOAD::'))
})
