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

test('createAoiOsPipeline initializes full v36 pipeline with 120 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v36',
    taskId: 'TASK-2026-36',
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

  // 2. Database Transaction Rollback Guard
  const dbTxCheck = pipeline.auditDbTransactionSafety("try { await client.query('BEGIN'); await client.query('COMMIT'); } catch(e) { await client.query('ROLLBACK'); }")
  assert.equal(dbTxCheck.safe, true)
  assert.equal(dbTxCheck.transactionProof, 'TRANSACTION_LIFECYCLE_PROTECTED')

  // 3. Dead Script Pruner
  const scriptCheck = pipeline.auditDeadScriptCoverage(['test:parity'], 'pnpm test:parity')
  assert.equal(scriptCheck.allReferenced, true)
  assert.equal(scriptCheck.scriptProof, 'ALL_PACKAGE_SCRIPTS_REFERENCED')

  // 4. Safe HTML & DOM Sanitization Guard
  const htmlCheck = pipeline.auditHtmlSanitization('<div v-html="DOMPurify.sanitize(userInput)"></div>')
  assert.equal(htmlCheck.safe, true)
  assert.equal(htmlCheck.xssProof, 'HTML_SANITIZATION_PROVEN')

  // 5. Sandbox Env Isolation Prover
  const envIsoCheck = pipeline.auditSandboxEnvIsolation("spawn('cmd', [], { env: { PATH: process.env.PATH } })")
  assert.equal(envIsoCheck.safe, true)
  assert.equal(envIsoCheck.isolationProof, 'SANDBOX_ENV_ISOLATION_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v36 centurial 120-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
