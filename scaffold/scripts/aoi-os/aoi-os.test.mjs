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

test('createAoiOsPipeline initializes full v62 pipeline with 224 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v62',
    taskId: 'TASK-2026-62',
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

  // 2. Atomic File Watcher BigInt Stat Precision Guard
  const watcherBigIntCheck = pipeline.auditFileWatcherBigInts('const s = fs.statSync(file, { bigint: true }); if (s.mtimeNs > prevNs) {}')
  assert.equal(watcherBigIntCheck.safe, true)
  assert.equal(watcherBigIntCheck.watcherBigIntProof, 'STAT_TIMESTAMP_BIGINT_PRECISION_ENFORCED')

  // 3. Dead TypeScript CheckJs Redundancy Pruner
  const checkJsCheck = pipeline.auditTsconfigCheckJsFlags({ compilerOptions: { allowJs: true, checkJs: true } })
  assert.equal(checkJsCheck.clean, true)
  assert.equal(checkJsCheck.checkJsProof, 'TSCONFIG_CHECK_JS_CONSISTENT')

  // 4. Safe Cryptographic TLS OCSP Stapling Verification Guard
  const tlsOcspCheck = pipeline.auditCryptoTlsOcsps("const s = tls.connect({ requestOCSP: true }); s.on('OCSPResponse', (r) => {});")
  assert.equal(tlsOcspCheck.safe, true)
  assert.equal(tlsOcspCheck.tlsOcspProof, 'TLS_OCSP_STAPLING_VERIFIED')

  // 5. Sandbox Process Windows Batch Metacharacter Escaping Prover
  const winBatchCheck = pipeline.auditSandboxProcessWindowsBatchEscapes(`
function escapeBatchArg(a) {
  return a.replace(/([\\^&|<>\'%"])/g, '^$1');
}
const c = spawn('run.bat', args.map(escapeBatchArg));
`)
  assert.equal(winBatchCheck.safe, true)
  assert.equal(winBatchCheck.batchEscapeProof, 'WINDOWS_BATCH_METACHARACTERS_ESCAPED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v62 sovereign 224-pillar master core'],
    diffSummary: 'server/api/tasks.ts (+224 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
