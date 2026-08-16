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

test('createAoiOsPipeline initializes full v27 pipeline with 84 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v27',
    taskId: 'TASK-2026-27',
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

  // 2. Lockfile Divergence Prover
  const lockfileCheck = pipeline.auditLockfileConvergence({ vue: ['3.5.34'] }, ['vue'])
  assert.equal(lockfileCheck.convergent, true)
  assert.equal(lockfileCheck.lockfileProof, 'LOCKFILE_CRITICAL_PACKAGES_UNIFIED')

  // 3. HTTP Header & CORS Guard
  const httpCheck = pipeline.auditHttpCorsSecurity("export const cors = { origin: ['https://app.com'], credentials: true };")
  assert.equal(httpCheck.safe, true)
  assert.equal(httpCheck.headerProof, 'HTTP_HEADERS_AND_CORS_SECURE')

  // 4. Dead Component Pruner
  const compCheck = pipeline.auditDeadComponentTree(['TaskBoard'], '<template><TaskBoard /></template>')
  assert.equal(compCheck.allRendered, true)
  assert.equal(compCheck.componentProof, 'ALL_DECLARED_COMPONENTS_RENDERED')

  // 5. Pipe Cleanup Prover
  const pipeCheck = pipeline.auditPipeCleanup("const s = '/tmp/test.sock'; fs.unlinkSync(s);")
  assert.equal(pipeCheck.safe, true)
  assert.equal(pipeCheck.pipeProof, 'ALL_IPC_PIPES_AND_SOCKETS_CLEANED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v27 supreme infinite singularity suite with 84 pillars'],
    diffSummary: 'server/api/tasks.ts (+60 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
