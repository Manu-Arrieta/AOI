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

test('createAoiOsPipeline initializes full v25 pipeline with 76 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v25',
    taskId: 'TASK-2026-25',
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

  // 2. Peer Dependency Guard
  const peerCheck = pipeline.auditPeerDependencies([
    { name: 'app-web', peerDependencies: { vue: '^3.5.0' } },
    { name: 'ui-lib', peerDependencies: { vue: '^3.5.0' } },
  ])
  assert.equal(peerCheck.convergent, true)
  assert.equal(peerCheck.convergenceProof, 'ALL_PEER_DEPENDENCIES_CONVERGENT_AND_UNIFIED')

  // 3. ReDoS Prover
  const redosCheck = pipeline.auditRedosVulnerabilities("export const r = /^[0-9]+$/;")
  assert.equal(redosCheck.safe, true)
  assert.equal(redosCheck.redosProof, 'ALL_REGEXES_LINEAR_AND_REDOS_SAFE')

  // 4. CSS Token Guard
  const cssCheck = pipeline.auditCssTokens(".btn { color: var(--color-primary); }", ['--color-primary'])
  assert.equal(cssCheck.valid, true)
  assert.equal(cssCheck.tokenProof, 'ALL_CSS_TOKENS_DECLARED_AND_CONVERGENT')

  // 5. Handle Leak Prover
  const handleCheck = pipeline.auditFileHandlesSafety("const fd = fs.openSync('a.txt'); try {} finally { fs.closeSync(fd); }")
  assert.equal(handleCheck.safe, true)
  assert.equal(handleCheck.handleProof, 'ALL_FILE_HANDLES_DETERMINISTICALLY_CLOSED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v25 omniverse master suite with 76 pillars'],
    diffSummary: 'server/api/tasks.ts (+55 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
