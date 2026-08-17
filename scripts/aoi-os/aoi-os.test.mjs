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

test('createAoiOsPipeline initializes full v56 pipeline with 200 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v56',
    taskId: 'TASK-2026-56',
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

  // 2. Atomic Stream Duplex & Half-Close Socket Guard
  const halfCloseCheck = pipeline.auditStreamHalfCloses("const s = net.createConnection({ port: 80, allowHalfOpen: true }); s.on('end', () => s.destroy());")
  assert.equal(halfCloseCheck.safe, true)
  assert.equal(halfCloseCheck.halfCloseProof, 'HALF_OPEN_SOCKET_TEARDOWN_ENFORCED')

  // 3. Dead TypeScript Target-Lib Consistency Pruner
  const targetLibCheck = pipeline.auditTsconfigTargetLibs({ compilerOptions: { target: 'ES2022', lib: ['DOM'] } })
  assert.equal(targetLibCheck.clean, true)
  assert.equal(targetLibCheck.targetLibProof, 'TARGET_LIB_CANONICAL')

  // 4. Safe Cryptographic RSA-PSS Padding & Salt Guard
  const rsaPssCheck = pipeline.auditCryptoRsaPssPaddings("const sig = crypto.sign('sha256', d, { key: k, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST });")
  assert.equal(rsaPssCheck.safe, true)
  assert.equal(rsaPssCheck.rsaPssProof, 'RSA_PSS_PADDING_CANONICAL')

  // 5. Sandbox Process windowsHide Isolation Prover
  const windowsHideCheck = pipeline.auditSandboxProcessWindowsHide("const p = spawn('node', ['app.js'], { cwd: '/s', windowsHide: true });")
  assert.equal(windowsHideCheck.safe, true)
  assert.equal(windowsHideCheck.windowsHideProof, 'CROSS_PLATFORM_HEADLESS_PROCESS_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v56 bicentennial 200-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+200 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
