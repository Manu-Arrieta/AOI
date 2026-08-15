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

test('createAoiOsPipeline initializes full v14 pipeline with Dependency Solver, Event Store, Benchmark Suite, and Axiom Reconciler', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v14',
    taskId: 'TASK-2026-14',
    constitutionRules: 'Must use strict typing and no eval',
    globalTokenBudget: 100000,
    federatedPeers: ['MoviHub'],
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)
  assert.ok(pipeline.eventStore.getEventCount() >= 1)

  // 1. Prepare task T-1
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')
  assert.ok(pipeline.eventStore.getEventCount() >= 2)

  // 2. Polyglot Dependency Solver
  const depCheck = pipeline.auditDependencies({ dependencies: { zod: '^3.24.1' } }, ['zod', 'node:path'])
  assert.equal(depCheck.compatible, true)

  // 3. Zero-Overhead Micro-Benchmark Suite
  const bench = pipeline.benchmarkFunction('testFn', () => 1 + 1, { iterations: 500 })
  assert.equal(bench.passed, true)
  assert.ok(bench.opsPerSec > 0)

  // 4. Axiom Self-Reconciler
  const axiomCheck = pipeline.auditAxiomEquilibrium(
    ['Use $fetch instead of raw fetch'],
    [{ taskId: 'T-1', code: 'export async function run() { return await $fetch("/api"); }' }]
  )
  assert.equal(axiomCheck.inEquilibrium, true)

  // 5. Quantum Super-Position Synthesis Matrix
  const superPos = pipeline.synthesizeSuperposition([
    { id: 'b1', name: 'Complex', code: 'function f(x) { if (x > 1) { if (x > 2) return 3; } return 0; }' },
    { id: 'b2', name: 'Clean', code: 'function f(x) { return x > 2 ? 3 : 0; }' },
  ])
  assert.equal(superPos.winner.id, 'b2')

  // 6. Polyglot Deep Type & Schema Synthesizer
  const typesSchema = pipeline.synthesizeTypesAndSchema('function handleUser(userId, userAge, isActive)')
  assert.ok(typesSchema.tsInterface.includes('userId: string;'))

  // 7. Zero-Trust Kernel Syscall Virtual Guard
  const syscallCheck = pipeline.auditSyscalls('export function ok() { return 123; }')
  assert.equal(syscallCheck.safe, true)

  // 8. Branchless State Virtualizer
  const virtualSafe = pipeline.virtualizeControl('export function safe(m: any) { try { return 1; } finally { m.release(); } }')
  assert.equal(virtualSafe.safe, true)

  // 9. C2 Flight Recorder
  const spanId = pipeline.flightRecorder.startSpan('test_task_span', { taskId: 'T-1' })
  const span = pipeline.flightRecorder.endSpan(spanId, 'OK')
  assert.equal(span.status, 'OK')

  // 10. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v14 omniscient matrix suite'],
    diffSummary: 'server/api/tasks.ts (+40 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
