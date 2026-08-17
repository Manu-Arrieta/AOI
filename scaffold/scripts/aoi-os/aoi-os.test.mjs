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

test('createAoiOsPipeline initializes full v58 pipeline with 208 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v58',
    taskId: 'TASK-2026-58',
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

  // 2. Atomic File Append Sequential Lock Guard
  const appendLockCheck = pipeline.auditFileAppendLocks("const q = Promise.resolve(); async function append(d) { q = q.then(() => fs.promises.appendFile('/f', d)); }")
  assert.equal(appendLockCheck.safe, true)
  assert.equal(appendLockCheck.appendLockProof, 'FILE_APPEND_CONCURRENCY_LOCKED')

  // 3. Dead TypeScript Root Types Leakage Pruner
  const rootTypesCheck = pipeline.auditTsconfigRootTypes({ compilerOptions: { lib: ['DOM'], types: ['vite/client'] } }, true)
  assert.equal(rootTypesCheck.clean, true)
  assert.equal(rootTypesCheck.rootTypesProof, 'FRONTEND_TYPES_CONFINED')

  // 4. Safe Cryptographic X.509 Certificate Guard
  const x509Check = pipeline.auditCryptoX509Certs("const c = new crypto.X509Certificate(pem); if (c.checkHost('a.com')) trust(c);")
  assert.equal(x509Check.safe, true)
  assert.equal(x509Check.x509Proof, 'X509_CERTIFICATE_VALIDATED')

  // 5. Sandbox Process Detached Teardown Prover
  const detachedCheck = pipeline.auditSandboxProcessDetachedTeardowns("const p = spawn('d', [], { detached: true }); function exit() { process.kill(-p.pid, 'SIGTERM'); }")
  assert.equal(detachedCheck.safe, true)
  assert.equal(detachedCheck.detachedTeardownProof, 'DETACHED_PROCESS_GROUP_TEARDOWN_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v58 sovereign 208-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+208 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
