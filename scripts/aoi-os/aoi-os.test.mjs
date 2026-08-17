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

test('createAoiOsPipeline initializes full v46 pipeline with 160 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v46',
    taskId: 'TASK-2026-46',
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

  // 2. Atomic Stream Chunk UTF-8 Boundary Guard
  const chunkCheck = pipeline.auditStreamChunkBoundaries("import { StringDecoder } from 'node:string_decoder'; const dec = new StringDecoder('utf8'); stream.on('data', (d) => dec.write(d));")
  assert.equal(chunkCheck.safe, true)
  assert.equal(chunkCheck.boundaryProof, 'SAFE_UTF8_STREAM_BOUNDARY_DECODING_ENFORCED')

  // 3. Dead TypeScript Project Reference Pruner
  const tsconfigCheck = pipeline.auditTsconfigReferences({ references: [{ path: './packages/core' }] }, ['packages/core'])
  assert.equal(tsconfigCheck.clean, true)
  assert.equal(tsconfigCheck.referenceProof, 'TSCONFIG_PROJECT_REFERENCES_CANONICAL')

  // 4. Safe Cryptographic TLS Minimum Protocol Version Guard
  const tlsCheck = pipeline.auditCryptoTlsVersions("const s = https.createServer({ minVersion: 'TLSv1.3', key, cert });")
  assert.equal(tlsCheck.safe, true)
  assert.equal(tlsCheck.tlsProof, 'MODERN_TLS_MIN_VERSION_ENFORCED')

  // 5. Sandbox Child Process Stdio Buffer Flush Prover
  const stdioCheck = pipeline.auditSandboxStdioFlush("const child = spawn(cmd); child.on('close', (c) => resolve(c));")
  assert.equal(stdioCheck.safe, true)
  assert.equal(stdioCheck.flushProof, 'COMPLETE_STDIO_STREAM_FLUSH_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v46 transcendent 160-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+160 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
