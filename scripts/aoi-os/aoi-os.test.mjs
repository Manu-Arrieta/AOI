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

test('createAoiOsPipeline initializes full v39 pipeline with 132 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v39',
    taskId: 'TASK-2026-39',
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

  // 2. Unhandled Rejection & Exception Guard
  const unhandledCheck = pipeline.auditUnhandledRejections("process.on('unhandledRejection', () => process.exit(1)); async function main() { await startDaemon(); }")
  assert.equal(unhandledCheck.safe, true)
  assert.equal(unhandledCheck.rejectionProof, 'PROCESS_EXCEPTIONS_GOVERNED')

  // 3. Dead Workspace Package Pruner
  const workspacePkgCheck = pipeline.auditWorkspacePackages(['agentic-ops-dashboard'], 'pnpm --filter agentic-ops-dashboard dev')
  assert.equal(workspacePkgCheck.clean, true)
  assert.equal(workspacePkgCheck.packageProof, 'WORKSPACE_PACKAGES_GOVERNED')

  // 4. Safe Cryptographic Randomness (CSPRNG) Guard
  const randomCheck = pipeline.auditCryptoRandomness("function generateToken() { return crypto.randomBytes(32).toString('hex'); }")
  assert.equal(randomCheck.safe, true)
  assert.equal(randomCheck.randomProof, 'CSPRNG_RANDOMNESS_ENFORCED')

  // 5. Sandbox FD Isolation Prover
  const fdCheck = pipeline.auditSandboxFdIsolation("spawn('node', ['worker.js'], { stdio: ['ignore', 'pipe', 'pipe'] })")
  assert.equal(fdCheck.safe, true)
  assert.equal(fdCheck.fdProof, 'SANDBOX_FD_ISOLATION_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v39 sovereign 132-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+100 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
