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

test('createAoiOsPipeline initializes full v24 pipeline with 72 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v24',
    taskId: 'TASK-2026-24',
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

  // 2. Promise Cascade Guard
  const asyncCheck = pipeline.auditAsyncEventLoop("export async function fn() { await saveAsync(); }")
  assert.equal(asyncCheck.safe, true)
  assert.equal(asyncCheck.asyncProof, 'ASYNC_EVENT_LOOP_BOUNDED_AND_SAFE')

  // 3. Schema Sunset Sentinel
  const sunsetCheck = pipeline.auditFieldDeprecations("export const user = { id: 1, name: 'Alice' };", [{ name: 'oldName', replacement: 'name' }])
  assert.equal(sunsetCheck.modern, true)
  assert.equal(sunsetCheck.sentinelProof, 'ALL_REFERENCED_FIELDS_ACTIVE_AND_MODERN')

  // 4. Heap Allocation Prover
  const heapCheck = pipeline.auditHeapAllocationSafety("export const buf = Buffer.alloc(1024);")
  assert.equal(heapCheck.safe, true)
  assert.equal(heapCheck.heapProof, 'HEAP_ALLOCATIONS_BOUNDED_AND_SAFE')

  // 5. Sandbox Network Egress Interceptor
  const egressCheck = pipeline.auditSandboxEgress("export const hash = crypto.createHash('sha256').digest('hex');")
  assert.equal(egressCheck.hermetic, true)
  assert.equal(egressCheck.egressProof, 'OFFLINE_SANDBOX_EGRESS_CONTAINMENT_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v24 quantum master suite with 72 pillars'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
