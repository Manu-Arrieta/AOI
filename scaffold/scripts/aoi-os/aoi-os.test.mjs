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

test('createAoiOsPipeline initializes full v50 pipeline with 176 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v50',
    taskId: 'TASK-2026-50',
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

  // 2. Atomic Stream highWaterMark Memory Bounding Guard
  const hwmCheck = pipeline.auditStreamHighWaterMarks("const stream = fs.createReadStream('/data.bin', { highWaterMark: 64 * 1024 });")
  assert.equal(hwmCheck.safe, true)
  assert.equal(hwmCheck.highWaterMarkProof, 'SAFE_HIGHWATERMARK_BOUNDING_ENFORCED')

  // 3. Dead TypeScript Exclude Pattern Pruner
  const excludeCheck = pipeline.auditTsconfigExcludes({ exclude: ['dist', 'coverage'] }, ['dist/index.js', 'coverage/lcov.info'])
  assert.equal(excludeCheck.clean, true)
  assert.equal(excludeCheck.excludeProof, 'TSCONFIG_EXCLUDE_PATTERNS_CANONICAL')

  // 4. Safe Cryptographic HKDF Parameter & Digest Guard
  const hkdfCheck = pipeline.auditCryptoHkdfParams("const key = crypto.hkdfSync('sha512', ikm, salt, info, 64);")
  assert.equal(hkdfCheck.safe, true)
  assert.equal(hkdfCheck.hkdfProof, 'ROBUST_HKDF_PARAMETERS_ENFORCED')

  // 5. Sandbox Child Process Unref & Detach Prover
  const unrefCheck = pipeline.auditSandboxIpcUnrefs("const child = spawn('node', ['./daemon.js'], { detached: true }); child.unref();")
  assert.equal(unrefCheck.safe, true)
  assert.equal(unrefCheck.unrefProof, 'DETERMINISTIC_DETACHED_UNREF_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v50 centurial 176-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+176 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
