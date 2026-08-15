import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

import { parseCliArgs, runAoiOsCli } from './aoi-os-cli.mjs'

test('parseCliArgs extracts arguments into options object', () => {
  const args = [
    '--tasks', '.tasks/auth/TASK-1/tasks.md',
    '--workspace', 'MyWorkspace',
    '--feature', 'auth-module',
    '--task-id', 'TASK-1',
    '--dry-run',
  ]

  const opts = parseCliArgs(args)
  assert.equal(opts.tasksPath, '.tasks/auth/TASK-1/tasks.md')
  assert.equal(opts.workspace, 'MyWorkspace')
  assert.equal(opts.feature, 'auth-module')
  assert.equal(opts.taskId, 'TASK-1')
  assert.equal(opts.dryRun, true)
})

test('runAoiOsCli runs pipeline across execution waves', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-os-cli-test-'))
  const tasksFilePath = path.join(tmpDir, 'tasks.md')

  const sampleTasksContent = `
### Task T-1: Build API route [backend]
- Target: \`server/api/users.ts\`

### Task T-2: Build UI Dashboard [frontend] (Depends on: T-1)
- Target: \`app/components/UserBoard.vue\`
`
  fs.writeFileSync(tasksFilePath, sampleTasksContent, 'utf8')

  const executedCommands = []
  const summary = await runAoiOsCli(
    {
      tasksPath: tasksFilePath,
      workspace: 'TestWS',
      feature: 'users',
      taskId: 'TASK-2026',
      dryRun: false,
    },
    async (cmd) => {
      executedCommands.push(cmd)
      return { stdout: 'OK' }
    }
  )

  assert.equal(summary.totalNodes, 2)
  assert.equal(summary.totalWaves, 2)
  assert.equal(summary.waveResults.length, 2)
  assert.equal(summary.waveResults[0].waveNumber, 1)
  assert.equal(summary.waveResults[1].waveNumber, 2)
  assert.ok(executedCommands.length >= 2)

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true })
})
