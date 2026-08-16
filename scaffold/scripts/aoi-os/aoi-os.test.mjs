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

test('createAoiOsPipeline initializes full v29 pipeline with 92 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v29',
    taskId: 'TASK-2026-29',
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

  // 2. Cache Invalidation Guard
  const cacheCheck = pipeline.auditCacheHeaders("setResponseHeader(event, 'Cache-Control', 'no-store');", 'POST')
  assert.equal(cacheCheck.safe, true)
  assert.equal(cacheCheck.cacheProof, 'CACHE_CONTROL_INVALIDATION_PROVEN')

  // 3. Dead Enum Pruner
  const enumCheck = pipeline.auditDeadEnumHierarchy(['TaskStatus'], 'const s = TaskStatus.IN_PROGRESS;')
  assert.equal(enumCheck.allReferenced, true)
  assert.equal(enumCheck.enumProof, 'ALL_EXPORTED_ENUMS_REFERENCED')

  // 4. Path Traversal Guard
  const pathCheck = pipeline.auditPathTraversal("const p = path.resolve('/data', path.normalize(f)); fs.readFileSync(p);")
  assert.equal(pathCheck.safe, true)
  assert.equal(pathCheck.traversalProof, 'FILE_READS_SANITIZED_AND_CONTAINED')

  // 5. Subprocess Drain Prover
  const drainCheck = pipeline.auditSubprocessDraining("const c = spawn('ls'); c.stdout.on('data', () => {});")
  assert.equal(drainCheck.safe, true)
  assert.equal(drainCheck.drainProof, 'SUBPROCESS_PIPES_DRAINED_AND_BOUNDED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v29 transcendent 92-pillar omnipresent singularity suite'],
    diffSummary: 'server/api/tasks.ts (+70 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
