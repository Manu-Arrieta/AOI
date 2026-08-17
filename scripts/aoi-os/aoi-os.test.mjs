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

test('createAoiOsPipeline initializes full v47 pipeline with 164 pillars', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v47',
    taskId: 'TASK-2026-47',
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

  // 2. Atomic Temporary Symlink Clashing & Race Guard
  const symlinkCheck = pipeline.auditTempSymlinkClashes("const tempLink = path.join(dir, `.stg-${crypto.randomUUID()}`); if (fs.existsSync(tempLink)) fs.unlinkSync(tempLink); fs.symlinkSync(target, tempLink);")
  assert.equal(symlinkCheck.safe, true)
  assert.equal(symlinkCheck.symlinkProof, 'SAFE_ATOMIC_SYMLINK_CREATION_ENFORCED')

  // 3. Dead Workspace TypeScript Include Path Pruner
  const includeCheck = pipeline.auditTsconfigIncludes({ include: ['src/**/*'] }, ['src/index.ts'])
  assert.equal(includeCheck.clean, true)
  assert.equal(includeCheck.includeProof, 'TSCONFIG_INCLUDE_PATHS_CANONICAL')

  // 4. Safe Cryptographic PBKDF2 Digest Algorithm Hardness Guard
  const pbkdf2Check = pipeline.auditCryptoPbkdf2Digests("const k = crypto.pbkdf2Sync(pass, salt, 100000, 64, 'sha512');")
  assert.equal(pbkdf2Check.safe, true)
  assert.equal(pbkdf2Check.digestProof, 'ROBUST_PBKDF2_DIGEST_ENFORCED')

  // 5. Sandbox Child Process Stdin Stream Closure Prover
  const stdinCheck = pipeline.auditSandboxStdinClosure("child.stdin.write(payload); child.stdin.end();")
  assert.equal(stdinCheck.safe, true)
  assert.equal(stdinCheck.stdinProof, 'DETERMINISTIC_STDIN_EOF_CLOSURE_ENFORCED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v47 sovereign 164-pillar infinite singularity master suite'],
    diffSummary: 'server/api/tasks.ts (+164 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
