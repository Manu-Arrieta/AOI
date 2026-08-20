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

test('createAoiOsPipeline initializes full v70 pipeline with 256 pillars including staging naming & RLimit FSIZE', async () => {
  const pipeline = createAoiOsPipeline({
    tasksMarkdown: SAMPLE_TASKS_MD,
    workspace: 'AOI',
    feature: 'aoi-os-v70',
    taskId: 'TASK-2026-70',
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

  // 2. Atomic File Temp Extension & Hidden Naming Guard
  const tempExtCheck = pipeline.auditAtomicTempExtensions(`
    const tempPath = path.join(path.dirname(targetFile), \`.\${path.basename(targetFile)}.\${crypto.randomUUID()}.tmp\`);
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, targetFile);
  `)
  assert.equal(tempExtCheck.safe, true)
  assert.equal(tempExtCheck.atomicTempExtensionProof, 'HIDDEN_DOT_PREFIX_TMP_EXTENSION_VERIFIED')

  // 3. Dead tsconfig.json checkJs/allowJs Dependency Pruner
  const checkJsCheck = pipeline.auditTsconfigCheckJsAllowJsDependencies({
    compilerOptions: { checkJs: true, allowJs: true },
  })
  assert.equal(checkJsCheck.clean, true)
  assert.equal(checkJsCheck.checkJsAllowJsProof, 'TSCONFIG_CHECK_JS_ALLOW_JS_DEPENDENCY_VALID')

  // 4. Safe Cryptographic RSA-PSS PKCS#8 Key Export Guard
  const keyExportCheck = pipeline.auditCryptoRsaPssKeyExports(`
    const exportedKey = privateKey.export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-gcm',
      passphrase: 'secure-secret-password',
    });
  `)
  assert.equal(keyExportCheck.safe, true)
  assert.equal(keyExportCheck.rsaPssKeyExportProof, 'SECURE_PKCS8_KEY_EXPORT_VERIFIED')

  // 5. Sandbox Process POSIX RLimit FSIZE Prover
  const fsizeCheck = pipeline.auditSandboxProcessRlimitFsizes(`
    function spawnSandbox(scriptPath, args) {
      const child = spawn('sh', ['-c', 'ulimit -f 50000 && node ' + scriptPath], {
        maxDiskQuotaMb: 50,
      });
      return child;
    }
  `)
  assert.equal(fsizeCheck.safe, true)
  assert.equal(fsizeCheck.rlimitFsizeProof, 'SANDBOX_RLIMIT_FSIZE_BOUND_VERIFIED')

  // 6. Finalize Task and Auto-Sync to ICM
  const finalMem = await pipeline.finalizeTaskMemory('T-1', {
    decisions: ['Use deterministic v70 sovereign 256-pillar master core with Quantum Epistemic Hyper-Nexus runtime'],
    diffSummary: 'server/api/tasks.ts (+256 lines)',
  }, async () => ({ stdout: 'OK' }))

  assert.equal(finalMem.syncResult.executedCount, finalMem.payload.memories.length)
  assert.equal(pipeline.stateManager.getTask('T-1').status, 'completed')
})
