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

test('createAoiOsPipeline initializes full DAG, batches, consensus gate, AST mutex, fuzzing, C4 and time travel', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v7',
    taskId: 'TASK-2026-01',
    globalTokenBudget: 100000,
  })

  assert.equal(pipeline.rawNodes.length, 2)
  assert.equal(pipeline.batches.length, 2)

  // 1. Prepare task T-1
  const prep = pipeline.prepareTaskExecution('T-1')
  assert.equal(prep.node.id, 'T-1')
  assert.equal(prep.microAgent.role, 'backend')
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'in_progress')

  // 2. AST Symbol Mutex
  const lock = pipeline.symbolMutex.acquireLock('T-1', 'server/api/tasks.ts')
  assert.equal(lock.acquired, true)
  pipeline.symbolMutex.releaseLock('T-1', 'server/api/tasks.ts')

  // 3. Chaos Fuzzing
  const fuzz = pipeline.runChaosFuzzing([{ name: 'userId', type: 'string' }], 'getUser')
  assert.ok(fuzz.testCasesCount > 0)

  // 4. Dynamic C4 Diagram
  const c4 = pipeline.getC4ArchitectureDiagram('AOI-OS Core')
  assert.equal(c4.containerCount, 2)
  assert.ok(c4.mermaidDiagram.includes('subgraph System["AOI-OS Core"]'))

  // 5. Time Travel Snapshots
  pipeline.timeTravel.captureSnapshot(1, { wave: 1, completed: ['T-1'] })
  assert.equal(pipeline.timeTravel.getSnapshots().length, 2) // initial + wave 1

  // 6. AST Skeletonization & Pruning
  const sampleCode = Array.from({ length: 90 }, (_, i) => `export function fn${i}() {\n  return ${i};\n}`).join('\n')
  const pruned = pipeline.getPrunedSourceSlice(sampleCode, 'utils.ts', ['fn0'])
  assert.ok(pruned.savingsPercent > 0)

  // 7. Consensus Gate Arbitration
  const cleanCode = 'export function getTasks() { return [] }'
  const consensus = pipeline.evaluateConsensus('T-1', cleanCode, {
    testsPassed: true,
    astInvariantSafe: true,
  })
  assert.equal(consensus.approved, true)

  // 8. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic in-memory mutex'],
    diffSummary: 'server/api/tasks.ts (+10 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')

  // 9. Event Bus verifications
  const events = pipeline.eventBus.getRecentEvents(30)
  assert.ok(events.some((e) => e.type === 'chaos_fuzzer'))
  assert.ok(events.some((e) => e.type === 'consensus_gate'))
})
