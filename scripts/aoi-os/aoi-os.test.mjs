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

test('createAoiOsPipeline initializes full v60 pipeline with 216 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v60',
    taskId: 'TASK-2026-60',
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

  // 2. Atomic File Watcher Debounce Guard
  const watcherCheck = pipeline.auditFileWatcherDebounces("let t; const w = fs.watch('/src', () => { clearTimeout(t); t = setTimeout(run, 100); }); function close() { w.close(); }")
  assert.equal(watcherCheck.safe, true)
  assert.equal(watcherCheck.watcherProof, 'FILE_WATCHER_DEBOUNCED_AND_DISPOSED')

  // 3. Dead TypeScript Exact Optional Properties Pruner
  const exactOptCheck = pipeline.auditTsconfigExactOptionals({ compilerOptions: { strict: true, exactOptionalPropertyTypes: true } })
  assert.equal(exactOptCheck.clean, true)
  assert.equal(exactOptCheck.exactOptionalProof, 'TSCONFIG_EXACT_OPTIONAL_CANONICAL')

  // 4. Safe Cryptographic TLS SNI Guard
  const tlsSniCheck = pipeline.auditCryptoTlsSnis("const s = tls.connect({ host: '10.0.0.1', port: 443, servername: 'api.example.com' });")
  assert.equal(tlsSniCheck.safe, true)
  assert.equal(tlsSniCheck.tlsSniProof, 'TLS_SNI_RFC6066_ENFORCED')

  // 5. Sandbox Process Windows Path Normalization Prover
  const winPathCheck = pipeline.auditSandboxProcessWindowsPaths("const bin = path.resolve('./bin/runner.exe'); spawn(bin, []);")
  assert.equal(winPathCheck.safe, true)
  assert.equal(winPathCheck.windowsPathProof, 'CROSS_PLATFORM_SPAWN_PATH_NORMALIZED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v60 grand epistemic 216-pillar master core'],
    diffSummary: 'server/api/tasks.ts (+216 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
