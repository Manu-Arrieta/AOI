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

test('createAoiOsPipeline initializes full v17 pipeline with Knowledge Mesh Reconciler, ABI Broadcaster, Cache Optimizer, and Resource Prover', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v17',
    taskId: 'TASK-2026-17',
    constitutionRules: 'Must use strict typing and no eval',
    globalTokenBudget: 100000,
    federatedPeers: ['MoviHub'],
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)
  assert.ok(pipeline.eventStore.getEventCount() >= 1)

  // 1. Prepare task T-1
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')

  // 2. Knowledge Mesh Reconciler
  const meshDrift = pipeline.auditKnowledgeDrift([{ id: 'm1', topic: 'decisions', content: 'Use Pinia' }], ['Use Pinia'])
  assert.equal(meshDrift.inSync, true)

  // 3. ABI Wave Broadcaster
  const abiWave = pipeline.broadcastAbiUpdates('contracts/user.ts', { 'web-app': ['contracts/user.ts'] })
  assert.equal(abiWave.totalAffectedWorkspaces, 1)

  // 4. Prompt Cache Prefix Optimizer
  const cacheOpt = pipeline.optimizeCachePrefix({ systemRules: 'Rule 1', contractSchemas: 'Schema 1', taskDiff: 'Diff 1' })
  assert.equal(cacheOpt.prefixCacheKey.length, 64)

  // 5. Resource Containment Prover
  const resourceCheck = pipeline.auditResourceLeaks('export function run() { return 1; }')
  assert.equal(resourceCheck.hermetic, true)

  // 6. Zero-Knowledge Epistemic Attestor
  const attestation = pipeline.attestTaskCompliance('T-1', [{ assertion: 'Route compiles', passed: true }])
  assert.equal(attestation.allPassed, true)

  // 7. Root Cause Diagnostic Synthesizer
  const diag = pipeline.diagnoseError('AssertionError: Expected 1 === 2')
  assert.equal(diag.archetype, 'ASSERTION_VALUE_MISMATCH')

  // 8. Circular Dependency Neutralizer
  const circ = pipeline.auditCircularDependencies({ 'a.ts': ['b.ts'], 'b.ts': [] })
  assert.equal(circ.hasCycles, false)

  // 9. Token Liquidity Balancer
  const liquidity = pipeline.rebalanceLiquidity(100000, [{ taskId: 'T-1', complexity: 'low' }, { taskId: 'T-2', complexity: 'extreme' }])
  assert.equal(liquidity.liquidityStatus, 'BALANCED_AND_STARVATION_FREE')

  // 10. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v17 hyper-omniscience suite'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
