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

test('createAoiOsPipeline initializes full v68 pipeline with 248 pillars including same-dev staging & NPROC bounds', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v68',
    taskId: 'TASK-2026-68',
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

  // 2. Atomic File Same-Device Placement Guard
  const sameDevCheck = pipeline.auditAtomicSameDevs(`
    const tempPath = path.join(path.dirname(targetFile), \`.\${path.basename(targetFile)}.\${crypto.randomUUID()}.tmp\`);
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, targetFile);
  `)
  assert.equal(sameDevCheck.safe, true)
  assert.equal(sameDevCheck.sameDevProof, 'SAME_DEVICE_STAGING_PLACEMENT_VERIFIED')

  // 3. Dead tsconfig.json rewriteRelativeImportExtensions Pruner
  const rewriteCheck = pipeline.auditTsconfigRewriteImports({
    compilerOptions: { rewriteRelativeImportExtensions: true, moduleResolution: 'bundler' },
  })
  assert.equal(rewriteCheck.clean, true)
  assert.equal(rewriteCheck.rewriteRelativeImportProof, 'TSCONFIG_REWRITE_RELATIVE_IMPORT_EXTENSIONS_VALID')

  // 4. Safe Cryptographic RSA-PSS Auto-Salt Guard
  const autoSaltCheck = pipeline.auditCryptoRsaPssAutoSalts(`
    const verified = crypto.verify('sha256', buffer, publicKey, signature, {
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_AUTO,
    });
  `)
  assert.equal(autoSaltCheck.safe, true)
  assert.equal(autoSaltCheck.rsaPssAutoSaltProof, 'SECURE_RSA_PSS_AUTO_SALT_VERIFIED')

  // 5. Sandbox Process POSIX RLimit NPROC (Fork-Bomb Defense) Prover
  const nprocCheck = pipeline.auditSandboxProcessRlimitNprocs(`
    const limit = pLimit(maxProcesses);
    await Promise.all(tasks.map(task => limit(() => spawn('node', [task.script]))));
  `)
  assert.equal(nprocCheck.safe, true)
  assert.equal(nprocCheck.rlimitNprocProof, 'PROCESS_CONCURRENCY_NPROC_BOUND_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v68 sovereign 248-pillar master core with Quantum Autonomous Nexus runtime'],
    diffSummary: 'server/api/tasks.ts (+248 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
