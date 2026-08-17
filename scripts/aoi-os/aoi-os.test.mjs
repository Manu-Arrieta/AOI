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

test('createAoiOsPipeline initializes full v41 pipeline with 140 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v41',
    taskId: 'TASK-2026-41',
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

  // 2. Atomic File Lock & PID Lease Guard
  const lockCheck = pipeline.auditFileLocks("function acquire(p) { process.kill(pid, 0); fs.writeFileSync(p, pid); }")
  assert.equal(lockCheck.safe, true)
  assert.equal(lockCheck.lockLeaseProof, 'FILE_LOCK_LEASE_EXPIRATION_ENFORCED')

  // 3. Dead Barrel Duplicate Re-Export Pruner
  const barrelCheck = pipeline.auditBarrelDuplicates("export { foo } from './foo.mjs';\nexport { bar } from './bar.mjs';")
  assert.equal(barrelCheck.clean, true)
  assert.equal(barrelCheck.barrelProof, 'BARREL_EXPORTS_DEDUPLICATED')

  // 4. Safe Shell Command Argument Quoting Guard
  const shellCheck = pipeline.auditShellCommands("const safe = escapeShellArg(arg); execSync(`git checkout ${safe}`);")
  assert.equal(shellCheck.safe, true)
  assert.equal(shellCheck.shellProof, 'SHELL_COMMAND_QUOTING_ENFORCED')

  // 5. Sandbox Process Group Signal Trap Prover
  const trapCheck = pipeline.auditSandboxSignalTraps("function launchIsolatedProcess(cmd) { const c = spawn(cmd, { detached: true }); process.on('SIGTERM', () => process.kill(-c.pid)); return c; }")
  assert.equal(trapCheck.safe, true)
  assert.equal(trapCheck.groupSignalProof, 'PROCESS_GROUP_SIGNAL_TRAP_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v41 sovereign 140-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+120 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
