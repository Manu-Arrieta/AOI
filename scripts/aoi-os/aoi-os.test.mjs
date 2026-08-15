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

test('createAoiOsPipeline initializes full v11 pipeline with Memo Engine, Wave Balancer, BFT Quorum, and Polyglot Transpiler', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v11',
    taskId: 'TASK-2026-11',
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

  // 2. AST Content-Addressable Memo Engine
  const code = 'export function add(a: number, b: number): number {\n  return a + b;\n}'
  const diff1 = pipeline.memoEngine.diffSymbolCache('math.ts', code)
  assert.equal(diff1.mutatedSymbols.length, 1)

  // 3. Adaptive Wave Worker Balancer
  const balanced = pipeline.balanceWave(0, 2)
  assert.equal(balanced.workerCount, 2)

  // 4. BFT Multi-Verifier Cognitive Quorum
  const quorum = pipeline.evaluateBftQuorumVerdict({
    sourceCode: code,
    filePath: 'math.ts',
    testsPassed: true,
  })
  assert.equal(quorum.quorumApproved, true)
  assert.equal(quorum.consensusScore, 100)

  // 5. Polyglot Contract Transpiler
  const poly = pipeline.transpileInterfacePolyglot('export interface Account { id: string; }')
  assert.ok(poly.csharp.includes('public class AccountDto'))
  assert.ok(poly.python.includes('class Account(BaseModel):'))
  assert.ok(poly.sql.includes('CREATE TABLE IF NOT EXISTS account'))

  // 6. Live Micro-Patch Kernel
  pipeline.patchKernel.registerSymbol('test:fn', () => 1)
  assert.equal(pipeline.patchKernel.invokeSymbol('test:fn'), 1)

  // 7. Symbolic Invariant Proof
  const proof = pipeline.proveInvariants('export function safe(x: number) { if (x < 0) throw new Error("neg"); return x * 2; }', 'safe')
  assert.equal(proof.satisfiable, true)

  // 8. Test Flakiness & Race Detector
  const flakiness = pipeline.auditFlakiness('test("pure", () => { expect(1).toBe(1); })', 'pure.test.ts')
  assert.equal(flakiness.deterministic, true)

  // 9. Bidirectional ABI Alignment
  const abi = pipeline.alignAbi(
    'export interface Task { taskId: string; }',
    'public class TaskDto { public string TaskId { get; set; } }'
  )
  assert.equal(abi.aligned, true)

  // 10. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v11 cognitive matrix suite'],
    diffSummary: 'server/api/tasks.ts (+25 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
