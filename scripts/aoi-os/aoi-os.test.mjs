import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsPipeline } from './aoi-os.mjs'

const SAMPLE_TASKS_MD = `
### Task T-1: Build API route [backend]
- Target: \`server/api/tasks.ts\`
- ## Test Requirements:
  - Return 200 OK

### Task T-2: Build C# Core Service [backend] (Depends on: T-1)
- Target: \`Services/TaskService.cs\`
`

test('createAoiOsPipeline initializes full v19 pipeline with Entropy Prover, Delta Compressor, Route Collision Matrix, and Capability Enforcer', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v19',
    taskId: 'TASK-2026-19',
    constitutionRules: 'Must use strict typing and no eval',
    globalTokenBudget: 100000,
    federatedPeers: ['MoviHub'],
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)
  assert.ok(pipeline.eventStore.getEventCount() >= 1)

  // 1. Prepare task T-1 with Capability Token
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(prep.capabilityToken.signature.length, 64)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')

  // 2. Capability Enforcer verification
  const capCheck = pipeline.verifyCapability(prep.capabilityToken, { operation: 'MUTATE_FILE', target: 'server/api/tasks.ts' })
  assert.equal(capCheck.authorized, true)

  // 3. Epistemic Entropy Prover
  const entropyCheck = pipeline.auditEntropy('export function f() {}', 'export const f = () => {}')
  assert.equal(entropyCheck.isSimplifiedOrStable, true)

  // 4. Delta Snapshot Compressor
  const delta = pipeline.compressStateDelta({ a: 1 }, { a: 2 })
  assert.equal(delta.hasChanges, true)

  // 5. API Route Collision Matrix
  const routeAudit = pipeline.auditApiCollisions([
    { method: 'GET', path: '/api/tasks' },
    { method: 'POST', path: '/api/tasks' },
  ])
  assert.equal(routeAudit.hasCollisions, false)

  // 6. Epistemic Game Engine (Nash Equilibrium)
  const nash = pipeline.evaluateGameConsensus({ testsPassed: true, securitySafe: true, contractsIntact: true, performanceScore: 90 })
  assert.equal(nash.isNashOptimal, true)

  // 7. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v19 universal synthesis suite'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
