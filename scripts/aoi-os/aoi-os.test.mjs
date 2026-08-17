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

test('createAoiOsPipeline initializes full v55 pipeline with 196 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v55',
    taskId: 'TASK-2026-55',
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

  // 2. Atomic Stream pipeline & finished Async Await Guard
  const pipelineCheck = pipeline.auditStreamPipelineAsync("import { pipeline } from 'node:stream/promises'; async function run() { await pipeline(a, b); }")
  assert.equal(pipelineCheck.safe, true)
  assert.equal(pipelineCheck.pipelineProof, 'STREAM_PIPELINE_PROMISE_AWAITED')

  // 3. Dead TypeScript Redundant Strict Sub-Flags Pruner
  const strictCheck = pipeline.auditTsconfigStrictFlags({ compilerOptions: { strict: true, target: 'es2022' } })
  assert.equal(strictCheck.clean, true)
  assert.equal(strictCheck.strictProof, 'TSCONFIG_STRICT_FLAGS_CANONICAL')

  // 4. Safe Cryptographic Key Pair Generation Guard
  const keyPairCheck = pipeline.auditCryptoKeyPairs("crypto.generateKeyPair('ed25519', (err, pub, priv) => {});")
  assert.equal(keyPairCheck.safe, true)
  assert.equal(keyPairCheck.keyPairProof, 'KEYPAIR_PARAMETERS_CANONICAL')

  // 5. Sandbox Worker TransferList & Zero-Copy Prover
  const transferCheck = pipeline.auditSandboxWorkerTransferLists("parentPort.postMessage(buffer, [buffer]);")
  assert.equal(transferCheck.safe, true)
  assert.equal(transferCheck.transferProof, 'ZERO_COPY_TRANSFER_LIST_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v55 sovereign 196-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+196 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
