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

test('createAoiOsPipeline initializes full v63 pipeline with 228 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v63',
    taskId: 'TASK-2026-63',
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

  // 2. Atomic File Watcher Error Listener Guard
  const watcherErrCheck = pipeline.auditFileWatcherErrors("const w = fs.watch(dir); w.on('error', (e) => log(e));")
  assert.equal(watcherErrCheck.safe, true)
  assert.equal(watcherErrCheck.watcherErrorProof, 'WATCHER_ERROR_HANDLER_VERIFIED')

  // 3. Dead TypeScript Composite Project Redundancy Pruner
  const compositeCheck = pipeline.auditTsconfigComposites({ compilerOptions: { composite: true, declaration: true } })
  assert.equal(compositeCheck.clean, true)
  assert.equal(compositeCheck.compositeProof, 'TSCONFIG_COMPOSITE_VALID')

  // 4. Safe Cryptographic TLS Renegotiation DoS Guard
  const tlsRenegCheck = pipeline.auditCryptoTlsRenegotiations("const s = tls.createServer({ minVersion: 'TLSv1.3' });")
  assert.equal(tlsRenegCheck.safe, true)
  assert.equal(tlsRenegCheck.tlsRenegotiationProof, 'TLS_RENEGOTIATION_DEFENSE_VERIFIED')

  // 5. Sandbox Process POSIX Shell Word Splitting Prover
  const posixShellCheck = pipeline.auditSandboxProcessPosixShells("const c = spawn('/bin/sh', ['-c', 'cat \"$FILE_PATH\"']);")
  assert.equal(posixShellCheck.safe, true)
  assert.equal(posixShellCheck.posixShellProof, 'POSIX_SHELL_VARIABLES_PROPERLY_QUOTED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v63 sovereign 228-pillar master core'],
    diffSummary: 'server/api/tasks.ts (+228 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
