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

test('createAoiOsPipeline initializes full v40 pipeline with 136 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v40',
    taskId: 'TASK-2026-40',
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

  // 2. Atomic File Write Guard
  const atomicCheck = pipeline.auditAtomicWrites("function saveState(file, data) { fs.writeFileSync(file + '.tmp', data); fs.renameSync(file + '.tmp', file); }")
  assert.equal(atomicCheck.safe, true)
  assert.equal(atomicCheck.atomicProof, 'ATOMIC_FILE_WRITES_ENFORCED')

  // 3. Dead Config Path Alias Pruner
  const aliasCheck = pipeline.auditConfigAliases(['@components/*'], "import Button from '@components/Button.vue'")
  assert.equal(aliasCheck.clean, true)
  assert.equal(aliasCheck.aliasProof, 'CONFIG_ALIASES_CANONICAL')

  // 4. Safe Regular Expression Unicode Flag Guard
  const unicodeCheck = pipeline.auditRegexUnicode("const pattern = /^[\\p{Letter}\\d]+$/u;")
  assert.equal(unicodeCheck.safe, true)
  assert.equal(unicodeCheck.unicodeProof, 'UNICODE_REGEX_SAFETY_ENFORCED')

  // 5. Sandbox Process Priority Prover
  const priorityCheck = pipeline.auditSandboxPriority("function launchCompiler(cmd) { return exec('nice -n 10 ' + cmd); }")
  assert.equal(priorityCheck.safe, true)
  assert.equal(priorityCheck.priorityProof, 'SCHEDULING_PRIORITY_GOVERNED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v40 transcendent 136-pillar omnipresent singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+100 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
