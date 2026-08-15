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

test('createAoiOsPipeline initializes full v16 pipeline with ZK Attestor, Root Cause Diagnostics, Circular Neutralizer, and Liquidity Balancer', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v16',
    taskId: 'TASK-2026-16',
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

  // 2. Zero-Knowledge Epistemic Attestor
  const attestation = pipeline.attestTaskCompliance('T-1', [
    { assertion: 'Route compiles', passed: true },
    { assertion: 'Tests pass', passed: true },
  ])
  assert.equal(attestation.allPassed, true)
  assert.equal(attestation.attestationProof, 'PROVEN_CRYPTOGRAPHIC_COMPLIANCE')

  // 3. Root Cause Diagnostic Synthesizer
  const diag = pipeline.diagnoseError('AssertionError: Expected 1 === 2')
  assert.equal(diag.archetype, 'ASSERTION_VALUE_MISMATCH')

  // 4. Circular Dependency Neutralizer
  const circ = pipeline.auditCircularDependencies({ 'a.ts': ['b.ts'], 'b.ts': [] })
  assert.equal(circ.hasCycles, false)

  // 5. Token Liquidity Balancer
  const liquidity = pipeline.rebalanceLiquidity(100000, [{ taskId: 'T-1', complexity: 'low' }, { taskId: 'T-2', complexity: 'extreme' }])
  assert.equal(liquidity.liquidityStatus, 'BALANCED_AND_STARVATION_FREE')

  // 6. Self-Refactoring AST Kernel
  const refactorDiagnosis = pipeline.proposeRefactor('export function add(a: number, b: number) { return a + b; }')
  assert.equal(refactorDiagnosis.needsRefactor, false)

  // 7. Database Migration Diff Synthesizer
  const migration = pipeline.generateDbMigration('users', { id: 'TEXT PRIMARY KEY' }, { id: 'TEXT PRIMARY KEY', active: 'BOOLEAN' })
  assert.equal(migration.hasChanges, true)

  // 8. Schema Convergence Prover
  const conv = pipeline.proveConvergence('export interface User { id: string; }', 'public class UserDto { public string Id { get; set; } }')
  assert.equal(conv.converged, true)

  // 9. Micro-Prompt Context Compactor
  const compacted = pipeline.compactPrompt('/* comment */ export const x = 1; // comment')
  assert.equal(compacted.compacted, 'export const x = 1;')

  // 10. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v16 omnipresent singularity suite'],
    diffSummary: 'server/api/tasks.ts (+50 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
