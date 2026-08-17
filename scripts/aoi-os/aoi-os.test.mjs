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

test('createAoiOsPipeline initializes full v38 pipeline with 128 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v38',
    taskId: 'TASK-2026-38',
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

  // 2. Sensitive Data & PII Masking Guard
  const piiCheck = pipeline.auditPiiMasking("logger.info({ user: 'alice', password: maskSecret(pwd) })")
  assert.equal(piiCheck.safe, true)
  assert.equal(piiCheck.piiProof, 'SENSITIVE_DATA_LOGGING_MASKED')

  // 3. Dead Gitignore Pruner
  const gitignoreCheck = pipeline.auditGitignore(['node_modules', '.output'])
  assert.equal(gitignoreCheck.clean, true)
  assert.equal(gitignoreCheck.gitignoreProof, 'GITIGNORE_RULES_CANONICAL')

  // 4. Safe Cryptographic Algorithm Guard
  const cryptoCheck = pipeline.auditCryptoAlgorithms("crypto.createHash('sha256').update(data).digest('hex')")
  assert.equal(cryptoCheck.safe, true)
  assert.equal(cryptoCheck.cryptoProof, 'SAFE_CRYPTO_ALGORITHMS_ENFORCED')

  // 5. Sandbox Process Resource Limit (RLimit) Prover
  const rlimitCheck = pipeline.auditSandboxRLimits("exec('ulimit -t 30 && node build.js')")
  assert.equal(rlimitCheck.safe, true)
  assert.equal(rlimitCheck.rlimitProof, 'SANDBOX_RLIMIT_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v38 transcendent 128-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+100 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
