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

test('createAoiOsPipeline initializes full v13 pipeline with Superposition Matrix, Deep Type Synthesizer, Token Hologram, and Syscall Guard', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v13',
    taskId: 'TASK-2026-13',
    constitutionRules: 'Must use strict typing and no eval',
    globalTokenBudget: 100000,
    federatedPeers: ['MoviHub'],
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)

  // 1. Prepare task T-1
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')

  // 2. Quantum Super-Position Synthesis Matrix
  const superPos = pipeline.synthesizeSuperposition([
    { id: 'b1', name: 'Complex', code: 'function f(x) { if (x > 1) { if (x > 2) return 3; } return 0; }' },
    { id: 'b2', name: 'Clean', code: 'function f(x) { return x > 2 ? 3 : 0; }' },
  ])
  assert.equal(superPos.winner.id, 'b2')

  // 3. Polyglot Deep Type & Schema Synthesizer
  const typesSchema = pipeline.synthesizeTypesAndSchema('function handleUser(userId, userAge, isActive)')
  assert.ok(typesSchema.tsInterface.includes('userId: string;'))
  assert.ok(typesSchema.zodSchema.includes('userAge: z.number(),'))

  // 4. Zero-Trust Kernel Syscall Virtual Guard
  const syscallCheck = pipeline.auditSyscalls('export function ok() { return 123; }')
  assert.equal(syscallCheck.safe, true)
  assert.equal(syscallCheck.hermeticProof, 'PROVEN_HERMETIC')

  // 5. Semantic Token Hologram
  assert.equal(pipeline.tokenHologram.containsConcept('eval'), true)
  assert.equal(pipeline.tokenHologram.toHexString().length, 64)

  // 6. Branchless State Virtualizer
  const virtualSafe = pipeline.virtualizeControl('export function safe(m: any) { try { return 1; } finally { m.release(); } }')
  assert.equal(virtualSafe.safe, true)

  // 7. C2 Flight Recorder
  const spanId = pipeline.flightRecorder.startSpan('test_task_span', { taskId: 'T-1' })
  pipeline.flightRecorder.addSpanEvent(spanId, 'test_event', { ok: true })
  const span = pipeline.flightRecorder.endSpan(spanId, 'OK')
  assert.equal(span.status, 'OK')

  // 8. Semantic Ontology & Knowledge Fabric
  const relNodes = pipeline.semanticFabric.queryRelatedNodes('task:T-2', 1)
  assert.ok(relNodes.some((r) => r.node.id === 'task:T-1'))

  // 9. Polyglot Contract Transpiler
  const poly = pipeline.transpileInterfacePolyglot('export interface Account { id: string; }')
  assert.ok(poly.csharp.includes('public class AccountDto'))

  // 10. Live Micro-Patch Kernel
  pipeline.patchKernel.registerSymbol('test:fn', () => 1)
  assert.equal(pipeline.patchKernel.invokeSymbol('test:fn'), 1)

  // 11. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v13 genesis core suite'],
    diffSummary: 'server/api/tasks.ts (+35 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
