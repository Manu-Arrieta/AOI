import test from 'node:test'
import assert from 'node:assert/strict'
import { createAoiOsPipeline } from './aoi-os.mjs'

const SAMPLE_TASKS_MD = `
### Task T-1: Build API route [backend]
- Target: \`server/api/tasks.ts\`
- ## Test Requirements:
  - User logs in with valid email password credentials returning JWT

### Task T-2: Build C# Core Service [backend] (Depends on: T-1)
- Target: \`Services/TaskService.cs\`
`

const SAMPLE_SPEC_MD = `
## User Story 1
As an operator, I want JWT authentication.
### Scenario: User logs in with valid email password credentials returning JWT
`

test('createAoiOsPipeline initializes full v65 pipeline with 236 pillars including Intent Sentinel & Direct Exec Prover', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v65',
    taskId: 'TASK-2026-65',
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

  // 2. User Intent Drift Sentinel
  const driftCode = 'export function loginUserWithValidCredentials(email, password) { return createOperatorJwtSession({ email, password }); }'
  const driftCheck = pipeline.auditUserIntentDrifts(SAMPLE_SPEC_MD, driftCode)
  assert.equal(driftCheck.safe, true)
  assert.equal(driftCheck.intentDriftProof, 'USER_INTENT_ALIGNMENT_PROVEN')

  // 3. Dead TypeScript ModuleResolution Incompatibility Pruner
  const modResCheck = pipeline.auditTsconfigModuleResolutions({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
  })
  assert.equal(modResCheck.clean, true)
  assert.equal(modResCheck.moduleResolutionProof, 'TSCONFIG_MODULE_RESOLUTION_VALID')

  // 4. Safe Cryptographic RSA-PSS MGF1 Hash Guard
  const rsaMgf1Check = pipeline.auditCryptoRsaPssMgf1("crypto.sign('sha256', buf, { key, padding: RSA_PKCS1_PSS_PADDING, mgf1Hash: 'sha256' });")
  assert.equal(rsaMgf1Check.safe, true)
  assert.equal(rsaMgf1Check.rsaPssMgf1Proof, 'SECURE_RSA_PSS_MGF1_HASH_VERIFIED')

  // 5. Direct Binary Execution Prover (No Intermediate Subshell)
  const directExecCheck = pipeline.auditSandboxProcessPosixExecs("const child = execFile('/bin/ls', ['-la']);")
  assert.equal(directExecCheck.safe, true)
  assert.equal(directExecCheck.posixExecProof, 'DIRECT_BINARY_EXECUTION_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v65 sovereign 236-pillar master core with Intent-Integrity runtime'],
    diffSummary: 'server/api/tasks.ts (+236 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
