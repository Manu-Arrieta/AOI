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

test('createAoiOsPipeline initializes full v26 pipeline with 80 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v26',
    taskId: 'TASK-2026-26',
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

  // 2. Env Secret Prover
  const envCheck = pipeline.auditEnvSafety("export const db = process.env.DATABASE_URL;", ['DATABASE_URL'])
  assert.equal(envCheck.safe, true)
  assert.equal(envCheck.envProof, 'ENV_AND_SECRETS_COMPLIANT_AND_HERMETIC')

  // 3. Structural Config Guard
  const configCheck = pipeline.auditConfigStructure('{"name": "aoi-os", "version": "26.0.0"}', 'json')
  assert.equal(configCheck.valid, true)
  assert.equal(configCheck.structuralProof, 'CONFIG_SYNTAX_AND_AST_STRUCTURE_PROVEN')

  // 4. Dead Route Pruner
  const routeCheck = pipeline.auditDeadRouteCoverage(['/api/tasks'], "fetch('/api/tasks');")
  assert.equal(routeCheck.fullyCovered, true)
  assert.equal(routeCheck.prunerProof, 'ALL_API_ROUTES_ACTIVELY_REFERENCED')

  // 5. Signal Teardown Prover
  const signalCheck = pipeline.auditSignalTeardownSafety("const s = app.listen(3000); process.on('SIGINT', () => s.close());")
  assert.equal(signalCheck.safe, true)
  assert.equal(signalCheck.signalProof, 'GRACEFUL_SIGNAL_TEARDOWN_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v26 sovereign singularity suite with 80 pillars'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
