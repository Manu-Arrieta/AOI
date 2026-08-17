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

test('createAoiOsPipeline initializes full v45 pipeline with 156 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v45',
    taskId: 'TASK-2026-45',
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

  // 2. Atomic Hardlink Recursion & Inode Loop Guard
  const hardlinkCheck = pipeline.auditHardlinkRecursions("function walk(dir, seen = new Set()) { const s = fs.statSync(dir); if (seen.has(s.ino)) return; seen.add(s.ino); }")
  assert.equal(hardlinkCheck.safe, true)
  assert.equal(hardlinkCheck.recursionProof, 'BOUNDED_INODE_RECURSION_ENFORCED')

  // 3. Dead Package Binary Entrypoint Pruner
  const binCheck = pipeline.auditPackageBinaries({ bin: { 'aoi-cli': './dist/cli.mjs' } }, ['dist/cli.mjs'])
  assert.equal(binCheck.clean, true)
  assert.equal(binCheck.binaryProof, 'PACKAGE_BINARIES_CANONICAL')

  // 4. Safe Cryptographic Elliptic Curve Hardness Guard
  const ecCheck = pipeline.auditEcCurves("const ecdh = crypto.createECDH('prime256v1');")
  assert.equal(ecCheck.safe, true)
  assert.equal(ecCheck.curveProof, 'ROBUST_ELLIPTIC_CURVE_HARDNESS_ENFORCED')

  // 5. Sandbox Dynamic Import Subresource Integrity (SRI) Prover
  const sriCheck = pipeline.auditSriIntegrity("function loadScript(url, sha) { const s = document.createElement('script'); s.src = url; s.integrity = sha; }")
  assert.equal(sriCheck.safe, true)
  assert.equal(sriCheck.sriProof, 'CRYPTOGRAPHIC_SUBRESOURCE_INTEGRITY_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v45 sovereign 156-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+156 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
