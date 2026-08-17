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

test('createAoiOsPipeline initializes full v48 pipeline with 168 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v48',
    taskId: 'TASK-2026-48',
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

  // 2. Atomic Buffer Slicing & Subarray Bounds Guard
  const bufferCheck = pipeline.auditBufferSliceBounds("function readHeader(buf, offset, length) { if (offset + length <= buf.byteLength) return buf.subarray(offset, offset + length); throw new RangeError(); }")
  assert.equal(bufferCheck.safe, true)
  assert.equal(bufferCheck.boundsProof, 'SAFE_BUFFER_BOUNDARY_VALIDATION_ENFORCED')

  // 3. Dead Monorepo tsconfig Compiler Options types Pruner
  const typesCheck = pipeline.auditTsconfigTypes({ compilerOptions: { types: ['node', 'vitest'] } }, ['@types/node', 'vitest'])
  assert.equal(typesCheck.clean, true)
  assert.equal(typesCheck.typesProof, 'TSCONFIG_TYPES_ARRAY_CANONICAL')

  // 4. Safe Cryptographic RSA Key Minimum Modulus Length Guard
  const rsaCheck = pipeline.auditCryptoRsaKeyLengths("const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 4096 });")
  assert.equal(rsaCheck.safe, true)
  assert.equal(rsaCheck.rsaProof, 'ROBUST_RSA_MODULUS_LENGTH_ENFORCED')

  // 5. Sandbox Dynamic Worker MessagePort Transfer Prover
  const portCheck = pipeline.auditSandboxPortTransfers("const { port1, port2 } = new MessageChannel(); worker.postMessage({}, [port2]); worker.on('exit', () => port1.close());")
  assert.equal(portCheck.safe, true)
  assert.equal(portCheck.portProof, 'DETERMINISTIC_MESSAGE_PORT_CLOSURE_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v48 transcendent 168-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+168 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
