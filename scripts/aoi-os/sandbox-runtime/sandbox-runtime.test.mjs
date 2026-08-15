import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { createHermeticSandbox } from './sandbox-executor.mjs'
import { createTokenVelocityGuard } from './token-velocity-guard.mjs'

test('createHermeticSandbox isolates file operations and commits cleanly', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-sandbox-test-'))
  const testFileRel = 'src/service.ts'
  const fullTestFile = path.join(tmpDir, testFileRel)

  fs.mkdirSync(path.dirname(fullTestFile), { recursive: true })
  fs.writeFileSync(fullTestFile, 'export const initial = 1;', 'utf8')

  const sandbox = createHermeticSandbox({
    taskId: 'TASK-100',
    baseDir: tmpDir,
    filesToMount: [testFileRel],
  })

  // Verify file mounted
  assert.equal(sandbox.readFile(testFileRel), 'export const initial = 1;')

  // Modify in sandbox
  sandbox.writeFile(testFileRel, 'export const initial = 2;')
  // Verify workspace untouched before commit
  assert.equal(fs.readFileSync(fullTestFile, 'utf8'), 'export const initial = 1;')

  // Commit to workspace
  sandbox.commitToWorkspace()
  assert.equal(fs.readFileSync(fullTestFile, 'utf8'), 'export const initial = 2;')

  // Destroy sandbox
  sandbox.destroy()
  assert.equal(fs.existsSync(sandbox.sandboxPath), false)

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('createTokenVelocityGuard flags anomalies and calculates budgets', () => {
  const governor = createTokenVelocityGuard({
    globalTokenBudget: 50000,
    expectedTokensPerTask: 4000,
    anomalyThresholdPercent: 50, // threshold: 6000
  })

  // Normal usage
  const r1 = governor.recordUsage('T-1', 3000, 'backend')
  assert.equal(r1.isAnomaly, false)
  assert.equal(r1.recommendedMode, 'standard')
  assert.equal(r1.remainingBudget, 47000)

  // Anomaly usage (> 6000)
  const r2 = governor.recordUsage('T-2', 7500, 'frontend')
  assert.equal(r2.isAnomaly, true)
  assert.equal(r2.recommendedMode, 'hyper_compressed')

  const metrics = governor.getMetrics()
  assert.equal(metrics.totalTokensConsumed, 10500)
  assert.equal(metrics.recordedTasksCount, 2)
})
