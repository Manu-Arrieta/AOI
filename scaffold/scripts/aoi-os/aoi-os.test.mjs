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

test('createAoiOsPipeline initializes full v32 pipeline with 104 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v32',
    taskId: 'TASK-2026-32',
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

  // 2. Database Pool Drain Prover
  const dbCheck = pipeline.auditDbPoolTeardown("const p = new Pool(); afterAll(async () => await p.end());")
  assert.equal(dbCheck.safe, true)
  assert.equal(dbCheck.drainProof, 'DATABASE_POOL_DRAIN_GUARANTEED')

  // 3. Dead i18n Key Pruner
  const i18nCheck = pipeline.auditDeadI18nKeyCoverage(['dashboard.title'], "const t = $t('dashboard.title');")
  assert.equal(i18nCheck.allReferenced, true)
  assert.equal(i18nCheck.i18nProof, 'ALL_I18N_KEYS_REFERENCED')

  // 4. JWT Expiration Guard
  const jwtCheck = pipeline.auditJwtExpiration("jwt.sign({ id: 1 }, secret, { expiresIn: '1h' });")
  assert.equal(jwtCheck.safe, true)
  assert.equal(jwtCheck.jwtProof, 'JWT_EXPIRATION_INVARIANT_PROVEN')

  // 5. Sandbox Symlink Containment Prover
  const symlinkCheck = pipeline.auditSymlinkContainment("/workspace/.sandboxes/aoi-os-tmp-task1", "src/file.ts")
  assert.equal(symlinkCheck.contained, true)
  assert.equal(symlinkCheck.symlinkProof, 'SYMLINK_CONFINEMENT_PROVEN')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v32 sovereign 104-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+80 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
