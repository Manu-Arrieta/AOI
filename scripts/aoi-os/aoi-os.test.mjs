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

test('createAoiOsPipeline initializes full v49 pipeline with 172 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v49',
    taskId: 'TASK-2026-49',
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

  // 2. Atomic Stream & EventEmitter MaxListeners Leak Guard
  const maxListenersCheck = pipeline.auditStreamMaxListeners("function setup(emitter, list) { emitter.setMaxListeners(100); for (const item of list) { emitter.on('data', console.log); } }")
  assert.equal(maxListenersCheck.safe, true)
  assert.equal(maxListenersCheck.listenersProof, 'SAFE_MAX_LISTENERS_BOUNDING_ENFORCED')

  // 3. Dead TypeScript Path Mapping Prefix Pruner
  const pathPrefixCheck = pipeline.auditTsconfigPathPrefixes({ compilerOptions: { paths: { '@core/*': ['src/core/*'] } } }, ['src/core'])
  assert.equal(pathPrefixCheck.clean, true)
  assert.equal(pathPrefixCheck.pathsProof, 'TSCONFIG_PATH_MAPPINGS_CANONICAL')

  // 4. Safe Cryptographic Diffie-Hellman Group & Prime Length Guard
  const dhCheck = pipeline.auditCryptoDhGroups("const dh = crypto.getDiffieHellman('modp14'); dh.generateKeys();")
  assert.equal(dhCheck.safe, true)
  assert.equal(dhCheck.dhProof, 'ROBUST_DH_GROUP_ENFORCED')

  // 5. Sandbox Child Process IPC Channel Disconnect Prover
  const ipcCheck = pipeline.auditSandboxIpcDisconnects("const child = fork('./worker.js'); child.on('exit', () => child.disconnect());")
  assert.equal(ipcCheck.safe, true)
  assert.equal(ipcCheck.disconnectProof, 'DETERMINISTIC_IPC_DISCONNECT_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v49 sovereign 172-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+172 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
