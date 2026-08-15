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

test('createAoiOsPipeline initializes full v10 pipeline with Hot-Patch Kernel, Symbolic Prover, Flakiness Detector, and ABI Linker', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v10',
    taskId: 'TASK-2026-10',
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

  // 2. Live Micro-Patch Kernel
  pipeline.patchKernel.registerSymbol('test:fn', () => 1)
  assert.equal(pipeline.patchKernel.invokeSymbol('test:fn'), 1)
  pipeline.patchKernel.applyHotPatch('test:fn', () => 2)
  assert.equal(pipeline.patchKernel.invokeSymbol('test:fn'), 2)

  // 3. Symbolic Invariant Proof
  const proof = pipeline.proveInvariants('export function safe(x: number) { if (x < 0) throw new Error("neg"); return x * 2; }', 'safe')
  assert.equal(proof.satisfiable, true)
  assert.ok(proof.invariantsProven >= 1)

  // 4. Test Flakiness & Race Detector
  const flakiness = pipeline.auditFlakiness('test("pure", () => { expect(1).toBe(1); })', 'pure.test.ts')
  assert.equal(flakiness.deterministic, true)

  // 5. Bidirectional ABI Alignment
  const abi = pipeline.alignAbi(
    'export interface Task { taskId: string; }',
    'public class TaskDto { public string TaskId { get; set; } }'
  )
  assert.equal(abi.aligned, true)

  // 6. Static Taint Analysis
  const taintCheck = pipeline.auditTaintSecurity('export function clean() { return 123; }', 'clean.ts')
  assert.equal(taintCheck.safe, true)

  // 7. Dead-Code Hygiene Guard
  const deadCheck = pipeline.auditDeadCodeHygiene('export function ok() { const x = 1; return x; }', 'ok.ts')
  assert.equal(deadCheck.clean, true)

  // 8. Constitution Drift Auditor
  const constCheck = pipeline.auditConstitution('export function valid(): number { return 10; }', 'valid.ts')
  assert.equal(constCheck.passed, true)

  // 9. E2E Acceptance Flow Synthesizer
  const e2eSuite = pipeline.generateE2eAcceptanceSuite({ suiteName: 'AOI-OS Master Flow' })
  assert.ok(e2eSuite.includes("describe('AOI-OS Master Flow'"))

  // 10. Mutation Testing Analysis
  const mutants = pipeline.performMutationAnalysis('export function isMatch(a: string, b: string) { return a === b; }')
  assert.ok(mutants.length >= 1)

  // 11. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v10 engineering suite'],
    diffSummary: 'server/api/tasks.ts (+20 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
