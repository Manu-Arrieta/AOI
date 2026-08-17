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

test('createAoiOsPipeline initializes full v43 pipeline with 148 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v43',
    taskId: 'TASK-2026-43',
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

  // 2. Atomic Temporary File Collision & Cryptographic Prefix Guard
  const tmpCheck = pipeline.auditTempFiles("function createTmp(dir) { return path.join(dir, '.tmp-' + crypto.randomUUID() + '.json'); }")
  assert.equal(tmpCheck.safe, true)
  assert.equal(tmpCheck.tempFileProof, 'COLLISION_FREE_CSPRNG_TEMP_IDENTIFIER_ENFORCED')

  // 3. Dead Lifecycle Script Hook Pruner
  const hookCheck = pipeline.auditScriptHooks({ scripts: { prepare: 'pnpm run build', build: 'tsc' } }, ['build'])
  assert.equal(hookCheck.clean, true)
  assert.equal(hookCheck.hookProof, 'LIFECYCLE_HOOKS_CANONICAL')

  // 4. Safe Cryptographic Cipher Mode & GCM Auth Tag Guard
  const cipherCheck = pipeline.auditCipherModes("const c = crypto.createCipheriv('aes-256-gcm', k, iv); const tag = c.getAuthTag();")
  assert.equal(cipherCheck.safe, true)
  assert.equal(cipherCheck.cipherProof, 'AUTHENTICATED_AEAD_CIPHER_ENFORCED')

  // 5. Sandbox Child Process IPC Message Length Prover
  const ipcCheck = pipeline.auditSandboxIpcPayloads("function send(c, m) { if (Buffer.byteLength(JSON.stringify(m)) > 1024) throw new Error(); c.send(m); }")
  assert.equal(ipcCheck.safe, true)
  assert.equal(ipcCheck.ipcPayloadProof, 'BOUNDED_IPC_MESSAGE_PAYLOAD_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v43 sovereign 148-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+148 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
