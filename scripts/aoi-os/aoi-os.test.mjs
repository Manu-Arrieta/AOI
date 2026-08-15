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

test('createAoiOsPipeline initializes full v22 pipeline with 64 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v22',
    taskId: 'TASK-2026-22',
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

  // 2. Semantic AST Merge Prover
  const mergeResult = pipeline.mergeAstBranches({
    baseCode: 'export const V = 1;\n',
    branchACode: 'export const V = 1;\nexport function a() {}\n',
    branchBCode: 'export const V = 1;\nexport function b() {}\n',
  })
  assert.equal(mergeResult.success, true)
  assert.equal(mergeResult.mergeProof, 'DISJOINT_3WAY_AST_MERGE_PROVEN')

  // 3. Query Performance Guard
  const queryResult = pipeline.auditDbQueries('export const q = "SELECT * FROM users WHERE id = 1";', ['id'])
  assert.equal(queryResult.optimal, true)

  // 4. Bundle Drift Verifier
  const bundleResult = pipeline.auditBundleImports("import { map } from 'lodash-es';")
  assert.equal(bundleResult.clean, true)

  // 5. Zombie Process Purger
  pipeline.processRegistry.registerProcess(999, 'node worker.js')
  const purgeResult = pipeline.purgeZombiePids()
  assert.equal(purgeResult.success, true)
  assert.equal(purgeResult.purgerProof, 'ZERO_ZOMBIE_PROCESSES_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v22 apex master suite with 64 pillars'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
