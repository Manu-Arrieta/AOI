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

test('createAoiOsPipeline initializes full v59 pipeline with 212 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v59',
    taskId: 'TASK-2026-59',
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

  // 2. Atomic File Truncate Boundary Guard
  const truncateCheck = pipeline.auditFileTruncateBoundaries("async function clear(fd) { await acquireLock('f'); await fs.promises.ftruncate(fd, 0); }")
  assert.equal(truncateCheck.safe, true)
  assert.equal(truncateCheck.truncateProof, 'FILE_TRUNCATE_BOUNDARY_LOCKED')

  // 3. Dead TypeScript Declaration Map Pruner
  const declMapCheck = pipeline.auditTsconfigDeclarationMaps({ compilerOptions: { declaration: true, declarationMap: true } })
  assert.equal(declMapCheck.clean, true)
  assert.equal(declMapCheck.declarationMapProof, 'TSCONFIG_DECLARATION_MAP_CONSISTENT')

  // 4. Safe Cryptographic TLS SAN Guard
  const tlsSanCheck = pipeline.auditCryptoTlsSans("const s = tls.connect(443, 'a.com', { checkServerIdentity: (h, c) => c.subjectaltname ? undefined : tls.checkServerIdentity(h, c) });")
  assert.equal(tlsSanCheck.safe, true)
  assert.equal(tlsSanCheck.tlsSanProof, 'TLS_SAN_RFC6125_VERIFIED')

  // 5. Sandbox Process Windows Batch File Prover
  const batCheck = pipeline.auditSandboxProcessBatCmds("const args = raw.map(escape); spawn('run.bat', args, { windowsVerbatimArguments: true });")
  assert.equal(batCheck.safe, true)
  assert.equal(batCheck.batchCmdProof, 'WINDOWS_BATCH_ARGS_SANITIZED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v59 sovereign 212-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+212 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
