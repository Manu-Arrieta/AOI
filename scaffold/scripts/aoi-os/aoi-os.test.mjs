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

test('createAoiOsPipeline initializes full v15 pipeline with Refactoring Kernel, Migration Diff, Schema Convergence, and Prompt Compactor', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v15',
    taskId: 'TASK-2026-15',
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

  // 2. Self-Refactoring AST Kernel
  const refactorDiagnosis = pipeline.proposeRefactor('export function add(a: number, b: number) { return a + b; }')
  assert.equal(refactorDiagnosis.needsRefactor, false)

  // 3. Database Migration Diff Synthesizer
  const migration = pipeline.generateDbMigration('users', { id: 'TEXT PRIMARY KEY' }, { id: 'TEXT PRIMARY KEY', active: 'BOOLEAN' })
  assert.equal(migration.hasChanges, true)
  assert.ok(migration.upSql.includes('ALTER TABLE users ADD COLUMN active BOOLEAN;'))

  // 4. Schema Convergence Prover
  const conv = pipeline.proveConvergence('export interface User { id: string; }', 'public class UserDto { public string Id { get; set; } }')
  assert.equal(conv.converged, true)

  // 5. Micro-Prompt Context Compactor
  const compacted = pipeline.compactPrompt('/* comment */ export const x = 1; // comment')
  assert.equal(compacted.compacted, 'export const x = 1;')

  // 6. Polyglot Dependency Solver
  const depCheck = pipeline.auditDependencies({ dependencies: { zod: '^3.24.1' } }, ['zod', 'node:path'])
  assert.equal(depCheck.compatible, true)

  // 7. Zero-Overhead Micro-Benchmark Suite
  const bench = pipeline.benchmarkFunction('testFn', () => 1 + 1, { iterations: 500 })
  assert.equal(bench.passed, true)

  // 8. Axiom Self-Reconciler
  const axiomCheck = pipeline.auditAxiomEquilibrium(
    ['Use $fetch instead of raw fetch'],
    [{ taskId: 'T-1', code: 'export async function run() { return await $fetch("/api"); }' }]
  )
  assert.equal(axiomCheck.inEquilibrium, true)

  // 9. Quantum Super-Position Synthesis Matrix
  const superPos = pipeline.synthesizeSuperposition([
    { id: 'b1', name: 'Complex', code: 'function f(x) { if (x > 1) { if (x > 2) return 3; } return 0; }' },
    { id: 'b2', name: 'Clean', code: 'function f(x) { return x > 2 ? 3 : 0; }' },
  ])
  assert.equal(superPos.winner.id, 'b2')

  // 10. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v15 holo-genesis hyper-matrix suite'],
    diffSummary: 'server/api/tasks.ts (+45 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
