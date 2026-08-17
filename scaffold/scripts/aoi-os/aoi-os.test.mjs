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

test('createAoiOsPipeline initializes full v51 pipeline with 180 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v51',
    taskId: 'TASK-2026-51',
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

  // 2. Atomic Stream Pipe Auto-Destroy Guard
  const pipeCheck = pipeline.auditStreamPipeDestroys("import { pipeline } from 'node:stream/promises'; await pipeline(r, w);")
  assert.equal(pipeCheck.safe, true)
  assert.equal(pipeCheck.pipeProof, 'STREAM_PIPE_AUTO_DESTROY_ENFORCED')

  // 3. Dead TypeScript Compiler Options lib Pruner
  const libCheck = pipeline.auditTsconfigLibs({ compilerOptions: { lib: ['ESNext'] } }, { isNodeOnly: true })
  assert.equal(libCheck.clean, true)
  assert.equal(libCheck.libProof, 'TSCONFIG_LIBS_CANONICAL')

  // 4. Safe Cryptographic Scrypt Cost & Parameter Guard
  const scryptCheck = pipeline.auditCryptoScryptParams("const k = crypto.scryptSync(p, s, 64, { N: 16384, r: 8, p: 1 });")
  assert.equal(scryptCheck.safe, true)
  assert.equal(scryptCheck.scryptProof, 'ROBUST_SCRYPT_PARAMETERS_ENFORCED')

  // 5. Sandbox Process PATH Variable Sanitization Prover
  const pathCheck = pipeline.auditSandboxPathEnvs("const env = { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' };")
  assert.equal(pathCheck.safe, true)
  assert.equal(pathCheck.pathProof, 'CANONICAL_TRUSTED_PATH_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v51 sovereign 180-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+180 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
