import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsPipeline } from './aoi-os.mjs'

const SAMPLE_TASKS_MD = `
### Task T-1: Build API route [backend]
- Target: \`server/api/tasks.ts\`
- ## Test Requirements:
  - User logs in with valid email password credentials returning JWT

### Task T-2: Build C# Core Service [backend] (Depends on: T-1)
- Target: \`Services/TaskService.cs\`
`

const SAMPLE_SPEC_MD = `
## User Story 1
As an operator, I want JWT authentication.
### Scenario: User logs in with valid email password credentials returning JWT
`

test('createAoiOsPipeline initializes full v66 pipeline with 240 pillars including fsync Guard & SIGTERM Grace Prover', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v66',
    taskId: 'TASK-2026-66',
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

  // 2. Atomic File Persistence fsync Guard
  const fsyncCheck = pipeline.auditAtomicFileFsyncs(`
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    fs.renameSync(tempFile, targetFile);
  `)
  assert.equal(fsyncCheck.safe, true)
  assert.equal(fsyncCheck.atomicFsyncProof, 'ATOMIC_FILE_FSYNC_FLUSH_VERIFIED')

  // 3. Dead tsconfig.json isolatedDeclarations Pruner
  const isoDeclCheck = pipeline.auditTsconfigIsolatedDeclarations({
    compilerOptions: { isolatedDeclarations: true, declaration: true },
  })
  assert.equal(isoDeclCheck.clean, true)
  assert.equal(isoDeclCheck.isolatedDeclarationsProof, 'TSCONFIG_ISOLATED_DECLARATIONS_VALID')

  // 4. Safe Cryptographic AES-GCM AuthTag Length Guard
  const aesGcmCheck = pipeline.auditCryptoAesGcmTagLengths("const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });")
  assert.equal(aesGcmCheck.safe, true)
  assert.equal(aesGcmCheck.aesGcmTagLengthProof, 'STRICT_16_BYTE_AES_GCM_AUTHTAG_VERIFIED')

  // 5. Tiered SIGTERM/SIGKILL Process Teardown Prover
  const sigkillCheck = pipeline.auditSandboxProcessSigkillGraces(`
    child.kill('SIGTERM');
    setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
  `)
  assert.equal(sigkillCheck.safe, true)
  assert.equal(sigkillCheck.sigkillGraceProof, 'TIERED_SIGTERM_SIGKILL_GRACE_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v66 sovereign 240-pillar master core with High-Assurance runtime'],
    diffSummary: 'server/api/tasks.ts (+240 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
