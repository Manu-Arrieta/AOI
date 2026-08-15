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

test('createAoiOsPipeline initializes full v21 pipeline with Provenance Chain, Export Guard, Budget Throttle, and Timing Guard', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v21',
    taskId: 'TASK-2026-21',
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

  // 2. Epistemic Provenance Chain
  const block = pipeline.recordProvenance({
    taskId: 'T-1',
    requirement: 'Build API route',
    modifiedFiles: ['server/api/tasks.ts'],
    assertions: ['Return 200 OK'],
    memoryId: '01M035F0SR',
  })
  assert.equal(block.index, 0)
  assert.equal(block.hash.length, 64)
  assert.equal(pipeline.provenanceChain.verifyChainIntegrity().valid, true)

  // 3. Export Leak Prover
  const exportCheck = pipeline.auditPackageExports("import { foo } from 'aoi-os';", ['aoi-os'])
  assert.equal(exportCheck.hermetic, true)

  // 4. Budget Auto-Throttle
  const throttle = pipeline.checkThrottlePolicy(30000)
  assert.equal(throttle.throttleMode, 'STANDARD')

  // 5. Timing Leak Guard
  const timingCheck = pipeline.auditTimingAttackSafety("import crypto from 'node:crypto'; crypto.timingSafeEqual(b1, b2);")
  assert.equal(timingCheck.safe, true)

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v21 diamond master suite'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
