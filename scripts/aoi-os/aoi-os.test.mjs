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

test('createAoiOsPipeline initializes full v30 pipeline with 96 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v30',
    taskId: 'TASK-2026-30',
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

  // 2. Rate Limit Guard
  const rateCheck = pipeline.auditRateLimits("export default defineEventHandler((e) => { useRateLimiter(e, { maxRequests: 10 }); });", true)
  assert.equal(rateCheck.safe, true)
  assert.equal(rateCheck.rateLimitProof, 'RATE_LIMITING_PROTECTION_PROVEN')

  // 3. Dead Export Package Pruner
  const exportCheck = pipeline.auditPackageExportCoverage('@aoi/core', ['.'], "import { main } from '@aoi/core';")
  assert.equal(exportCheck.allReferenced, true)
  assert.equal(exportCheck.exportProof, 'ALL_PACKAGE_EXPORTS_REFERENCED')

  // 4. Hydration Mismatch Guard
  const hydrationCheck = pipeline.auditComponentHydration("<script setup>const val = ref(1);</script><template><div>{{ val }}</div></template>")
  assert.equal(hydrationCheck.safe, true)
  assert.equal(hydrationCheck.hydrationProof, 'SSR_HYDRATION_DETERMINISM_PROVEN')

  // 5. Sandbox Temp Cleanup Prover
  const tempCheck = pipeline.auditSandboxTempCleanup("const t = fs.mkdtempSync('/tmp'); try {} finally { fs.rmSync(t, { recursive: true }); }")
  assert.equal(tempCheck.safe, true)
  assert.equal(tempCheck.cleanupProof, 'TEMP_DIRECTORY_CLEANUP_GUARANTEED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v30 supreme 96-pillar infinite singularity suite'],
    diffSummary: 'server/api/tasks.ts (+75 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
