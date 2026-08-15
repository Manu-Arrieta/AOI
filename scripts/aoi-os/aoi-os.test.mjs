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

test('createAoiOsPipeline initializes full DAG, batches, consensus gate, and ICM linker', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v3',
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

  // 2. Hermetic sandbox creation
  const sandbox = pipeline.createTaskSandbox('T-1')
  assert.ok(sandbox.sandboxPath.includes('aoi-os-tmp-T-1'))
  sandbox.destroy()

  // 3. Polyglot AST check (C#)
  const originalCs = 'public interface ITaskService { Task RunAsync(); }'
  const proposedCs = 'public interface ITaskService { Task RunAsync(); Task StopAsync(); }'
  const astCheck = pipeline.verifyCodeChange('Services/TaskService.cs', originalCs, proposedCs)
  assert.equal(astCheck.safe, true)
  assert.equal(astCheck.language, 'csharp')

  // 4. Consensus Gate Arbitration
  const cleanCode = 'export function getTasks() { return [] }'
  const consensus = pipeline.evaluateConsensus('T-1', cleanCode, {
    testsPassed: true,
    astInvariantSafe: true,
  })
  assert.equal(consensus.approved, true)
  assert.equal(consensus.score, 100)

  // 5. Finalize Task and Auto-Sync to ICM
  const executedCommands = []
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use in-memory circular buffer'],
    diffSummary: 'server/api/tasks.ts (+10 lines)',
  }, async (cmd) => {
    executedCommands.push(cmd)
    return { stdout: 'OK' }
  })

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')

  // 6. Verify Event Bus captured all event types
  const events = pipeline.eventBus.getRecentEvents(25)
  assert.ok(events.some((e) => e.type === 'consensus_gate'))
  assert.ok(events.some((e) => e.type === 'memory_synced'))
})
