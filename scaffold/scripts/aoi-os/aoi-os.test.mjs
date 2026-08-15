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

test('createAoiOsPipeline initializes full v18 pipeline with Nash Game Engine, Dead Asset Pruner, Speculative Wave Pipeline, and SBOM Generator', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v18',
    taskId: 'TASK-2026-18',
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

  // 2. Epistemic Game Engine (Nash Equilibrium)
  const nash = pipeline.evaluateGameConsensus({ testsPassed: true, securitySafe: true, contractsIntact: true, performanceScore: 90 })
  assert.equal(nash.isNashOptimal, true)
  assert.equal(nash.consensusVerdict, 'NASH_EQUILIBRIUM_APPROVED')

  // 3. Monorepo Dead-Asset Pruner
  const assetReport = pipeline.auditZombieAssets(['logo.png', 'dead.png'], ['<img src="logo.png" />'])
  assert.equal(assetReport.deadAssetsCount, 1)

  // 4. Speculative Wave Pipeline Check
  assert.equal(pipeline.speculativePipeline.hasStagedWave(1), true)
  const promo = pipeline.speculativePipeline.promoteSpeculativeWave(1)
  assert.equal(promo.status, 'SPECULATIVE_WAVE_PROMOTED_ZERO_LATENCY')

  // 5. Deterministic SBOM Generator
  const sbom = pipeline.generateSbomReport([{ name: 'server/api/tasks.ts', content: 'export const x = 1;' }])
  assert.equal(sbom.bomFormat, 'CycloneDX')
  assert.equal(sbom.components[0].hashes[0].value.length, 64)

  // 6. Knowledge Mesh Reconciler
  const meshDrift = pipeline.auditKnowledgeDrift([{ id: 'm1', topic: 'decisions', content: 'Use Pinia' }], ['Use Pinia'])
  assert.equal(meshDrift.inSync, true)

  // 7. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v18 quantum super-matrix suite'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
