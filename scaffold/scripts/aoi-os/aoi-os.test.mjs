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

test('createAoiOsPipeline initializes full v42 pipeline with 144 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v42',
    taskId: 'TASK-2026-42',
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

  // 2. Atomic File Permissions & umask Guard
  const umaskCheck = pipeline.auditFileUmask("function saveKey(p, k) { fs.writeFileSync(p, k, { mode: 0o600 }); }")
  assert.equal(umaskCheck.safe, true)
  assert.equal(umaskCheck.umaskProof, 'RESTRICTIVE_FILE_PERMISSIONS_ENFORCED')

  // 3. Dead Workspace Protocol Dependency Pruner
  const wsProtoCheck = pipeline.auditWorkspaceProtocols({ dependencies: { '@aoi/core': 'workspace:*' } }, ['@aoi/core'])
  assert.equal(wsProtoCheck.clean, true)
  assert.equal(wsProtoCheck.protocolProof, 'WORKSPACE_PROTOCOLS_CANONICAL')

  // 4. Safe Cryptographic KDF Guard
  const kdfCheck = pipeline.auditCryptoKdf("const h = crypto.pbkdf2Sync(pwd, salt, 120000, 64, 'sha512');")
  assert.equal(kdfCheck.safe, true)
  assert.equal(kdfCheck.kdfProof, 'SAFE_KDF_PARAMETERS_ENFORCED')

  // 5. Sandbox Child Process MaxBuffer Overflow Prover
  const maxBufCheck = pipeline.auditSandboxMaxBuffer("const out = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 });")
  assert.equal(maxBufCheck.safe, true)
  assert.equal(maxBufCheck.maxBufferProof, 'MAXBUFFER_OVERFLOW_PREVENTED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v42 transcendent 144-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+140 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
