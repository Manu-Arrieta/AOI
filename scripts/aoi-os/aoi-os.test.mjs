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

test('createAoiOsPipeline initializes full v9 pipeline with Taint Tracer, Dead-Code Guard, E2E flow, and Constitution auditor', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v9',
    taskId: 'TASK-2026-03',
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

  // 2. Static Taint Analysis
  const taintCheck = pipeline.auditTaintSecurity('export function clean() { return 123; }', 'clean.ts')
  assert.equal(taintCheck.safe, true)

  // 3. Dead-Code Hygiene Guard
  const deadCheck = pipeline.auditDeadCodeHygiene('export function ok() { const x = 1; return x; }', 'ok.ts')
  assert.equal(deadCheck.clean, true)

  // 4. Constitution Drift Auditor
  const constCheck = pipeline.auditConstitution('export function valid(): number { return 10; }', 'valid.ts')
  assert.equal(constCheck.passed, true)

  // 5. E2E Acceptance Flow Synthesizer
  const e2eSuite = pipeline.generateE2eAcceptanceSuite({ suiteName: 'AOI-OS Master Flow' })
  assert.ok(e2eSuite.includes("describe('AOI-OS Master Flow'"))

  // 6. Predictive Complexity Estimation
  const complexity = pipeline.predictComplexity('export function run() { if (true) return 1; return 0; }', 'run.ts')
  assert.equal(complexity.complexityRating, 'low')

  // 7. Mutation Testing Analysis
  const mutants = pipeline.performMutationAnalysis('export function isMatch(a: string, b: string) { return a === b; }')
  assert.ok(mutants.length >= 1)

  // 8. OpenAPI 3.1 Synthesis
  const openApi = pipeline.getOpenApiSpecification({ title: 'AOI Governed Mesh' })
  assert.equal(openApi.openapi, '3.1.0')

  // 9. AST Symbol Mutex
  const lock = pipeline.symbolMutex.acquireLock('T-1', 'server/api/tasks.ts')
  assert.equal(lock.acquired, true)
  pipeline.symbolMutex.releaseLock('T-1', 'server/api/tasks.ts')

  // 10. Chaos Fuzzing
  const fuzz = pipeline.runChaosFuzzing([{ name: 'userId', type: 'string' }], 'getUser')
  assert.ok(fuzz.testCasesCount > 0)

  // 11. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v9 engineering suite'],
    diffSummary: 'server/api/tasks.ts (+15 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
