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

test('createAoiOsPipeline initializes full v52 pipeline with 184 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v52',
    taskId: 'TASK-2026-52',
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

  // 2. Atomic Stream Transform _final & _flush Cleanup Guard
  const finalCheck = pipeline.auditStreamTransformFinals("class MyTransform extends Transform { _flush(cb) { cb(); } }")
  assert.equal(finalCheck.safe, true)
  assert.equal(finalCheck.finalProof, 'DETERMINISTIC_TRANSFORM_FINAL_ENFORCED')

  // 3. Dead TypeScript JSX Configuration Pruner
  const jsxCheck = pipeline.auditTsconfigJsx({ compilerOptions: { jsx: 'react-jsx' } }, ['src/App.tsx'])
  assert.equal(jsxCheck.clean, true)
  assert.equal(jsxCheck.jsxProof, 'TSCONFIG_JSX_CANONICAL')

  // 4. Safe Cryptographic ChaCha20-Poly1305 Nonce & Auth Guard
  const chachaCheck = pipeline.auditCryptoChachaNonces("const c = crypto.createCipheriv('chacha20-poly1305', k, iv, { authTagLength: 16 }); c.getAuthTag();")
  assert.equal(chachaCheck.safe, true)
  assert.equal(chachaCheck.chachaProof, 'CHACHA20_POLY1305_AEAD_ENFORCED')

  // 5. Sandbox Child Process NODE_OPTIONS Sanitization Prover
  const nodeOptCheck = pipeline.auditSandboxNodeOptions("const env = { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' };")
  assert.equal(nodeOptCheck.safe, true)
  assert.equal(nodeOptCheck.nodeOptionsProof, 'SANITIZED_NODE_OPTIONS_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v52 transcendent 184-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+184 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
