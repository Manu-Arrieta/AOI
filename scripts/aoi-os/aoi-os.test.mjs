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

test('createAoiOsPipeline initializes full v57 pipeline with 204 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v57',
    taskId: 'TASK-2026-57',
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

  // 2. Atomic Stream objectMode & HighWaterMark Scale Guard
  const objectModeCheck = pipeline.auditStreamObjectModeHighWaterMarks("const s = new Transform({ objectMode: true, highWaterMark: 16 });")
  assert.equal(objectModeCheck.safe, true)
  assert.equal(objectModeCheck.objectModeProof, 'OBJECT_MODE_HIGHWATERMARK_SCALED')

  // 3. Dead TypeScript resolveJsonModule Pruner
  const jsonModuleCheck = pipeline.auditTsconfigJsonModules({ compilerOptions: { moduleResolution: 'bundler' } })
  assert.equal(jsonModuleCheck.clean, true)
  assert.equal(jsonModuleCheck.jsonModuleProof, 'TSCONFIG_JSON_MODULE_CANONICAL')

  // 4. Safe Cryptographic Decipher AuthTag Order Guard
  const decipherCheck = pipeline.auditCryptoDecipherAuthTags("const d = crypto.createDecipheriv('aes-256-gcm', k, iv); d.setAuthTag(tag); d.final();")
  assert.equal(decipherCheck.safe, true)
  assert.equal(decipherCheck.authTagOrderProof, 'AEAD_DECIPHER_AUTH_TAG_ORDER_VERIFIED')

  // 5. Sandbox Process IPC Serialization Prover
  const ipcCheck = pipeline.auditSandboxProcessSerializations("const p = fork('./worker.js', [], { cwd: '/s', serialization: 'advanced' });")
  assert.equal(ipcCheck.safe, true)
  assert.equal(ipcCheck.serializationProof, 'V8_ADVANCED_IPC_SERIALIZATION_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v57 sovereign 204-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+204 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
