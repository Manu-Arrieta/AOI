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

test('createAoiOsPipeline initializes full v33 pipeline with 108 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v33',
    taskId: 'TASK-2026-33',
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

  // 2. OpenTelemetry Span Lifecycle Guard
  const spanCheck = pipeline.auditSpanLifecycle("const s = tracer.startSpan('task'); try { await doWork(); } finally { s.end(); }")
  assert.equal(spanCheck.safe, true)
  assert.equal(spanCheck.spanProof, 'SPAN_LIFECYCLE_TERMINATION_PROVEN')

  // 3. Dead Env Flag Pruner
  const envCheck = pipeline.auditDeadEnvFlagCoverage(['PORT'], 'const p = process.env.PORT || 3000;')
  assert.equal(envCheck.allReferenced, true)
  assert.equal(envCheck.envProof, 'ALL_ENV_FLAGS_REFERENCED')

  // 4. Query Depth & Algorithmic Complexity Guard
  const depthCheck = pipeline.auditQueryDepth("const server = new ApolloServer({ schema, validationRules: [depthLimit(5)] });")
  assert.equal(depthCheck.safe, true)
  assert.equal(depthCheck.queryDepthProof, 'QUERY_DEPTH_RESTRICTION_PROVEN')

  // 5. Sandbox Shm & IPC Channel Cleanup Prover
  const shmCheck = pipeline.auditShmChannelCleanup("const { port1, port2 } = new MessageChannel(); afterAll(() => { port1.close(); port2.close(); });")
  assert.equal(shmCheck.safe, true)
  assert.equal(shmCheck.shmProof, 'IPC_CHANNEL_CLEANUP_GUARANTEED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v33 transcendent 108-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
