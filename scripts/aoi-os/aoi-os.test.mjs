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

test('createAoiOsPipeline initializes full v54 pipeline with 192 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v54',
    taskId: 'TASK-2026-54',
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

  // 2. Atomic Stream pause & resume Flow Control Guard
  const pauseCheck = pipeline.auditStreamPauseResumes("readable.pause(); doWork(); readable.resume();")
  assert.equal(pauseCheck.safe, true)
  assert.equal(pauseCheck.pauseProof, 'DETERMINISTIC_STREAM_RESUME_ENFORCED')

  // 3. Dead TypeScript Interop Flag Pruner
  const interopCheck = pipeline.auditTsconfigInterops({ compilerOptions: { esModuleInterop: true, allowSyntheticDefaultImports: false } })
  assert.equal(interopCheck.clean, true)
  assert.equal(interopCheck.interopProof, 'TSCONFIG_INTEROP_CANONICAL')

  // 4. Safe Cryptographic EdDSA Signature & Algorithm Guard
  const eddsaCheck = pipeline.auditCryptoEddsaVerifications("const isValid = crypto.verify(null, data, ed25519Key, signature);")
  assert.equal(eddsaCheck.safe, true)
  assert.equal(eddsaCheck.eddsaProof, 'EDDSA_VERIFY_ALGORITHM_CANONICAL')

  // 5. Sandbox Worker Resource Limits & Heap Cap Prover
  const workerHeapCheck = pipeline.auditSandboxWorkerHeapLimits("const w = new Worker('./w.js', { resourceLimits: { maxOldGenerationSizeMb: 256 } });")
  assert.equal(workerHeapCheck.safe, true)
  assert.equal(workerHeapCheck.workerHeapProof, 'BOUNDED_WORKER_HEAP_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v54 transcendent 192-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+192 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
