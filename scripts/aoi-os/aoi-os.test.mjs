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

test('createAoiOsPipeline initializes full v53 pipeline with 188 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v53',
    taskId: 'TASK-2026-53',
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

  // 2. Atomic Stream cork & uncork Memory Flush Guard
  const corkCheck = pipeline.auditStreamCorkUncorks("writable.cork(); writable.write('chunk'); process.nextTick(() => writable.uncork());")
  assert.equal(corkCheck.safe, true)
  assert.equal(corkCheck.corkProof, 'DETERMINISTIC_STREAM_UNCORK_ENFORCED')

  // 3. Dead TypeScript BaseUrl Configuration Pruner
  const baseUrlCheck = pipeline.auditTsconfigBaseUrls({ compilerOptions: { moduleResolution: 'bundler', baseUrl: '.', paths: { '@/*': ['./src/*'] } } })
  assert.equal(baseUrlCheck.clean, true)
  assert.equal(baseUrlCheck.baseUrlProof, 'TSCONFIG_BASE_URL_CANONICAL')

  // 4. Safe Cryptographic ECDH Curve Hardness Guard
  const ecdhCheck = pipeline.auditCryptoEcdhCurves("const ecdh = crypto.createECDH('x25519');")
  assert.equal(ecdhCheck.safe, true)
  assert.equal(ecdhCheck.ecdhProof, 'ECDH_CURVE_HARDNESS_ENFORCED')

  // 5. Sandbox Dynamic Linker Preload Sanitization Prover
  const ldCheck = pipeline.auditSandboxLdPreloads("const env = { ...process.env, PATH: '/usr/bin:/bin' };")
  assert.equal(ldCheck.safe, true)
  assert.equal(ldCheck.linkerProof, 'SANITIZED_DYNAMIC_LINKER_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v53 sovereign 188-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+188 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
