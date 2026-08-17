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

test('createAoiOsPipeline initializes full v34 pipeline with 112 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v34',
    taskId: 'TASK-2026-34',
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

  // 2. Worker Thread Termination Guard
  const workerCheck = pipeline.auditWorkerTeardown("const w = new Worker('./w.js'); afterAll(async () => await w.terminate());")
  assert.equal(workerCheck.safe, true)
  assert.equal(workerCheck.workerProof, 'WORKER_TERMINATION_GUARANTEED')

  // 3. Dead Store State Pruner
  const storeCheck = pipeline.auditDeadStoreStateCoverage(['activeFilter'], 'const f = store.activeFilter;')
  assert.equal(storeCheck.allReferenced, true)
  assert.equal(storeCheck.storeProof, 'ALL_STORE_PROPERTIES_REFERENCED')

  // 4. Stream Backpressure Guard
  const backpressureCheck = pipeline.auditStreamBackpressure("const ok = stream.push(chunk); if (!ok) stream.once('drain', () => {});")
  assert.equal(backpressureCheck.safe, true)
  assert.equal(backpressureCheck.backpressureProof, 'STREAMING_BACKPRESSURE_HANDLED')

  // 5. Sandbox Privilege Escalation Prover
  const escalationCheck = pipeline.auditPrivilegeEscalation("chmod 755 ./run.sh && node ./run.sh")
  assert.equal(escalationCheck.safe, true)
  assert.equal(escalationCheck.escalationProof, 'PRIVILEGE_ESCALATION_CONTAINMENT_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v34 absolute 112-pillar universal omniverse master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
