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

test('createAoiOsPipeline initializes full v20 pipeline with Bias Neutralizer, Nullability Guard, Density Maximizer, and Descriptor Sanitizer', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v20',
    taskId: 'TASK-2026-20',
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

  // 2. Epistemic Bias Neutralizer
  const biasCheck = pipeline.cleanseEpistemicBias('Implemented blazingly fast and revolutionary auth.')
  assert.equal(biasCheck.biasStatus, 'BIAS_NEUTRALIZED_AND_CLEANSED')

  // 3. Nullability Contract Guard
  const nullCheck = pipeline.auditNullability('export const getStreet = (u: any) => u.address?.street;', ['address'])
  assert.equal(nullCheck.safe, true)

  // 4. Cognitive Density Maximizer
  const densityCheck = pipeline.maximizeDensity('Please make sure to test and never ever drop tables.')
  assert.equal(densityCheck.signalDensityPct, 98)

  // 5. Descriptor Sanitizer
  const sanitCheck = pipeline.auditDescriptorSanitization(['src/index.ts', 'dist/app.js'])
  assert.equal(sanitCheck.clean, true)

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v20 omnipresent master suite'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
