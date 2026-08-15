import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTaskDag } from './dag-parser.mjs'
import {
  validateDagStructure,
  computeExecutionBatches,
  createTaskStateManager,
} from './dag-scheduler.mjs'

const SAMPLE_TASKS_MD = `
# Implementation Tasks

### Task T-1: Initialize DB schema [backend]
- Create migrations in \`server/db/migrations.ts\`
- ## Test Requirements:
  - Unit test migration runner

### Task T-2: Build API router [backend] (Depends on: T-1)
- Write endpoint \`server/api/users.ts\`
- ## Test Requirements:
  - 200 OK test

### Task T-3: Create Design System tokens [ux]
- Update \`app/assets/theme.css\`

### Task T-4: Build UI Component [frontend] (Depends on: T-2, T-3)
- Create \`app/components/UserList.vue\`
`

test('parseTaskDag extracts structured nodes and dependencies from markdown', () => {
  const nodes = parseTaskDag(SAMPLE_TASKS_MD)
  assert.equal(nodes.length, 4)

  assert.equal(nodes[0].id, 'T-1')
  assert.equal(nodes[0].role, 'backend')
  assert.deepEqual(nodes[0].dependsOn, [])
  assert.ok(nodes[0].targetFiles.includes('server/db/migrations.ts'))
  assert.ok(nodes[0].testRequirements.includes('Unit test migration runner'))

  assert.equal(nodes[1].id, 'T-2')
  assert.deepEqual(nodes[1].dependsOn, ['T-1'])

  assert.equal(nodes[2].id, 'T-3')
  assert.equal(nodes[2].role, 'ux')
  assert.deepEqual(nodes[2].dependsOn, [])

  assert.equal(nodes[3].id, 'T-4')
  assert.equal(nodes[3].role, 'frontend')
  assert.deepEqual(nodes[3].dependsOn, ['T-2', 'T-3'])
})

test('validateDagStructure detects cycles and missing dependencies', () => {
  const nodesWithMissingDep = [
    { id: 'T-1', dependsOn: ['NON_EXISTENT'], status: 'pending' },
  ]
  const res1 = validateDagStructure(nodesWithMissingDep)
  assert.equal(res1.valid, false)
  assert.ok(res1.errors[0].includes('non-existent task [NON_EXISTENT]'))

  const nodesWithCycle = [
    { id: 'T-1', dependsOn: ['T-2'], status: 'pending' },
    { id: 'T-2', dependsOn: ['T-1'], status: 'pending' },
  ]
  const res2 = validateDagStructure(nodesWithCycle)
  assert.equal(res2.valid, false)
  assert.ok(res2.errors[0].includes('Cycle detected'))
})

test('computeExecutionBatches organizes parallel waves correctly', () => {
  const nodes = parseTaskDag(SAMPLE_TASKS_MD)
  const batches = computeExecutionBatches(nodes)

  // Wave 1: T-1 and T-3 (no dependencies)
  assert.equal(batches.length, 3)
  assert.deepEqual(batches[0].map((n) => n.id).sort(), ['T-1', 'T-3'].sort())

  // Wave 2: T-2 (depends on T-1)
  assert.deepEqual(batches[1].map((n) => n.id), ['T-2'])

  // Wave 3: T-4 (depends on T-2 and T-3)
  assert.deepEqual(batches[2].map((n) => n.id), ['T-4'])
})

test('createTaskStateManager manages transitions and ready tasks', () => {
  const nodes = parseTaskDag(SAMPLE_TASKS_MD)
  const sm = createTaskStateManager(nodes)

  let ready = sm.getReadyTasks()
  assert.deepEqual(ready.map((n) => n.id).sort(), ['T-1', 'T-3'].sort())

  // Complete T-1
  sm.transition('T-1', 'completed', { durationMs: 120 })
  assert.equal(sm.getTask('T-1').status, 'completed')

  // Now T-2 should be ready, but not T-4 (since T-3 is still pending)
  ready = sm.getReadyTasks()
  assert.deepEqual(ready.map((n) => n.id).sort(), ['T-2', 'T-3'].sort())

  // Complete T-3 and T-2
  sm.transition('T-3', 'completed')
  sm.transition('T-2', 'completed')

  ready = sm.getReadyTasks()
  assert.deepEqual(ready.map((n) => n.id), ['T-4'])

  const history = sm.getHistory()
  assert.equal(history.length, 3)
  assert.equal(history[0].taskId, 'T-1')
  assert.equal(history[0].to, 'completed')
})
