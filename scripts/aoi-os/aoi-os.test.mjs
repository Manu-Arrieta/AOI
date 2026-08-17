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

test('createAoiOsPipeline initializes full v67 pipeline with 244 pillars including parent dir fsync & umask isolation', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v67',
    taskId: 'TASK-2026-67',
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

  // 2. Atomic File Parent Directory fsync Guard
  const parentDirFsyncCheck = pipeline.auditAtomicParentDirFsyncs(`
    fs.renameSync(tempFile, targetFile);
    const dirFd = fs.openSync(path.dirname(targetFile), 'r');
    fs.fsyncSync(dirFd);
    fs.closeSync(dirFd);
  `)
  assert.equal(parentDirFsyncCheck.safe, true)
  assert.equal(parentDirFsyncCheck.parentDirFsyncProof, 'PARENT_DIRECTORY_FSYNC_FLUSH_VERIFIED')

  // 3. Dead tsconfig.json erasableSyntaxOnly Pruner
  const erasableCheck = pipeline.auditTsconfigErasableSyntax({
    compilerOptions: { erasableSyntaxOnly: true, target: 'ESNext' },
  })
  assert.equal(erasableCheck.clean, true)
  assert.equal(erasableCheck.erasableSyntaxProof, 'TSCONFIG_ERASABLE_SYNTAX_VALID')

  // 4. Safe Cryptographic RSA-PSS Salt Length Guard
  const rsaSaltCheck = pipeline.auditCryptoRsaPssSaltLengths(`
    crypto.sign('sha256', buf, { key, padding: RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST });
  `)
  assert.equal(rsaSaltCheck.safe, true)
  assert.equal(rsaSaltCheck.rsaPssSaltLengthProof, 'SECURE_RSA_PSS_SALTLENGTH_VERIFIED')

  // 5. POSIX umask Isolation Prover in Sandbox
  const umaskCheck = pipeline.auditSandboxProcessPosixUmasks(`
    process.umask(0o077);
    const child = spawn('node', ['worker.mjs']);
  `)
  assert.equal(umaskCheck.safe, true)
  assert.equal(umaskCheck.posixUmaskProof, 'POSIX_UMASK_ISOLATION_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v67 sovereign 244-pillar master core with Infinite Transcendence runtime'],
    diffSummary: 'server/api/tasks.ts (+244 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
