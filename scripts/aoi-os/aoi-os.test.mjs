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

test('createAoiOsPipeline initializes full v37 pipeline with 124 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v37',
    taskId: 'TASK-2026-37',
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

  // 2. Outbound HTTP Request Timeout Guard
  const httpCheck = pipeline.auditHttpTimeouts("fetch('https://api.example.com', { signal: AbortSignal.timeout(3000) })")
  assert.equal(httpCheck.safe, true)
  assert.equal(httpCheck.timeoutProof, 'HTTP_REQUEST_TIMEOUT_PROTECTED')

  // 3. Dead Markdown Doc Link Pruner
  const docCheck = pipeline.auditMarkdownDocLinks('[Guide](docs/guide.md)', ['docs/guide.md'])
  assert.equal(docCheck.allValid, true)
  assert.equal(docCheck.docProof, 'ALL_DOC_LINKS_REACHABLE')

  // 4. Dynamic RegExp ReDoS Timeout Guard
  const regexCheck = pipeline.auditDynamicRegExps('const safe = pattern.slice(0, 50); new RegExp(safe);')
  assert.equal(regexCheck.safe, true)
  assert.equal(regexCheck.regexProof, 'DYNAMIC_REGEXP_LENGTH_BOUNDED')

  // 5. Sandbox Process Core Dump Prevention Prover
  const coredumpCheck = pipeline.auditSandboxCoreDumps("exec('ulimit -c 0 && node script.js')")
  assert.equal(coredumpCheck.safe, true)
  assert.equal(coredumpCheck.coreDumpProof, 'SANDBOX_CORE_DUMP_DISABLED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v37 sovereign 124-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+90 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
