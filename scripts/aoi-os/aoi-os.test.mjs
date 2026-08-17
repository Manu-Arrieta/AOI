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

test('createAoiOsPipeline initializes full v35 pipeline with 116 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v35',
    taskId: 'TASK-2026-35',
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

  // 2. Browser Storage Quota Guard
  const storageCheck = pipeline.auditBrowserStorage("try { localStorage.setItem('k', 'v'); } catch(e) {}")
  assert.equal(storageCheck.safe, true)
  assert.equal(storageCheck.storageProof, 'BROWSER_STORAGE_QUOTA_SAFE')

  // 3. Dead CSS Class Pruner
  const cssCheck = pipeline.auditDeadCssClassCoverage(['hero-title'], '<h1 class="hero-title">Title</h1>')
  assert.equal(cssCheck.allReferenced, true)
  assert.equal(cssCheck.cssClassProof, 'ALL_CSS_CLASSES_REFERENCED')

  // 4. Port Collision Prover
  const portCheck = pipeline.auditPortCollisions("const server = http.createServer(); server.listen(0);")
  assert.equal(portCheck.safe, true)
  assert.equal(portCheck.portProof, 'EPHEMERAL_PORT_BINDING_PROVEN')

  // 5. Sandbox Ulimit Prover
  const ulimitCheck = pipeline.auditSandboxUlimit("for (const f of files) { const c = await fs.readFile(f); }")
  assert.equal(ulimitCheck.safe, true)
  assert.equal(ulimitCheck.ulimitProof, 'BOUNDED_DESCRIPTOR_CONCURRENCY_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v35 sovereign 116-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
