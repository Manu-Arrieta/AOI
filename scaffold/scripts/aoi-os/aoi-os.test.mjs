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

test('createAoiOsPipeline initializes full v44 pipeline with 152 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v44',
    taskId: 'TASK-2026-44',
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

  // 2. Atomic Directory Traversal Boundary & Canonical Realpath Guard
  const dirCheck = pipeline.auditDirectoryBoundaries("function readFile(root, p) { const r = fs.realpathSync(path.resolve(root, p)); if (!r.startsWith(root)) throw new Error(); return fs.readFileSync(r); }")
  assert.equal(dirCheck.safe, true)
  assert.equal(dirCheck.boundaryProof, 'CANONICAL_WORKSPACE_BOUNDARY_ANCHORED')

  // 3. Dead Package Export Condition Pruner
  const expCheck = pipeline.auditExportConditions({ exports: { '.': { import: './dist/index.mjs' } } }, ['dist/index.mjs'])
  assert.equal(expCheck.clean, true)
  assert.equal(expCheck.exportConditionProof, 'PACKAGE_EXPORT_CONDITIONS_CANONICAL')

  // 4. Safe Cryptographic Timing-Safe Buffer Comparison Guard
  const timeBufCheck = pipeline.auditTimingSafeBuffers("function verifySignature(a, b) { const bA = Buffer.from(a); const bB = Buffer.from(b); if (bA.length !== bB.length) return false; return crypto.timingSafeEqual(bA, bB); }")
  assert.equal(timeBufCheck.safe, true)
  assert.equal(timeBufCheck.timingSafeProof, 'CONSTANT_TIME_BUFFER_COMPARISON_ENFORCED')

  // 5. Sandbox Worker AbortController Cancellation Prover
  const abortCheck = pipeline.auditAbortControllers("async function runJob(data, signal) { signal.throwIfAborted(); return compute(data); }")
  assert.equal(abortCheck.safe, true)
  assert.equal(abortCheck.abortProof, 'RESPONSIVE_ABORT_CONTROLLER_CANCELLATION_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v44 transcendent 152-pillar omnipresent singularity genesis suite'],
    diffSummary: 'server/api/tasks.ts (+152 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
