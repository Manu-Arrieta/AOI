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

test('createAoiOsPipeline initializes full v69 pipeline with 252 pillars including flock & core dump filtering', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v69',
    taskId: 'TASK-2026-69',
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

  // 2. Atomic File Advisory Lock Guard
  const flockCheck = pipeline.auditAtomicFlocks(`
    async function updateRegistry(filePath, data) {
      const release = await lockfile.lock(filePath);
      try {
        fs.writeFileSync(tempPath, data);
        fs.renameSync(tempPath, filePath);
      } finally {
        await release();
      }
    }
  `)
  assert.equal(flockCheck.safe, true)
  assert.equal(flockCheck.atomicFlockProof, 'EXCLUSIVE_ADVISORY_LOCK_VERIFIED')

  // 3. Dead tsconfig.json exactOptionalPropertyTypes Pruner
  const exactOptionalCheck = pipeline.auditTsconfigExactOptionalProperties({
    compilerOptions: { exactOptionalPropertyTypes: true, strict: true },
  })
  assert.equal(exactOptionalCheck.clean, true)
  assert.equal(exactOptionalCheck.exactOptionalProof, 'TSCONFIG_EXACT_OPTIONAL_PROPERTY_TYPES_VALID')

  // 4. Safe Cryptographic RSA-PSS Hash Algorithm Guard
  const hashAlgCheck = pipeline.auditCryptoRsaPssHashAlgorithms(`
    const signature = crypto.sign('sha256', buffer, {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    });
  `)
  assert.equal(hashAlgCheck.safe, true)
  assert.equal(hashAlgCheck.rsaPssHashProof, 'SECURE_RSA_PSS_HASH_ALGORITHM_VERIFIED')

  // 5. Sandbox Process POSIX Core Dump Filter Prover
  const coreDumpCheck = pipeline.auditSandboxProcessCoreDumpFilters(`
    function spawnSandbox(scriptPath, args) {
      const child = spawn('sh', ['-c', 'ulimit -c 0 && node ' + scriptPath], {
        dumpable: false,
      });
      return child;
    }
  `)
  assert.equal(coreDumpCheck.safe, true)
  assert.equal(coreDumpCheck.coreDumpFilterProof, 'SANDBOX_CORE_DUMP_FILTER_SUPPRESSION_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v69 sovereign 252-pillar master core with Quantum Epistemic Hyper-Core runtime'],
    diffSummary: 'server/api/tasks.ts (+252 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
