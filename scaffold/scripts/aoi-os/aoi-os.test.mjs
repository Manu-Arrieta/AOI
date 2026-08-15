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

test('createAoiOsPipeline initializes full v23 pipeline with 68 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v23',
    taskId: 'TASK-2026-23',
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

  // 2. Mutation Test Invariant Prover
  const testCheck = pipeline.auditTestInvariants("test('sample', () => { assert.equal(1, 1); });")
  assert.equal(testCheck.valid, true)
  assert.equal(testCheck.invariantProof, 'ALL_TESTS_CONTAIN_INVARIANT_ASSERTIONS')

  // 3. HTTP Payload Drift Guard
  const payloadCheck = pipeline.auditPayloadAlignment(['userId', 'title'], ['userId', 'title'])
  assert.equal(payloadCheck.aligned, true)
  assert.equal(payloadCheck.driftProof, 'PAYLOAD_SCHEMA_100PCT_ALIGNED')

  // 4. Barrel Star-Export Neutralizer
  const barrelCheck = pipeline.auditBarrelIndex("export { foo } from './foo.mjs';")
  assert.equal(barrelCheck.clean, true)
  assert.equal(barrelCheck.barrelProof, 'EXPLICIT_BARREL_EXPORTS_PROVEN')

  // 5. Sandbox File Permission & Mask Prover
  const permCheck = pipeline.auditFilePermissionsSafety("fs.writeFileSync('out.txt', data, { mode: 0o644 });")
  assert.equal(permCheck.secure, true)
  assert.equal(permCheck.permissionProof, 'LEAST_PRIVILEGE_PERMISSIONS_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v23 holo-singularity master suite with 68 pillars'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
