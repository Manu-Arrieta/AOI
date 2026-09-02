import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import {
  checkBinaries,
  checkMemoryGovernance,
  checkMultiHarnessRules,
  checkResourcesStructure,
  checkTaskRegistry,
  runAoiDoctor,
} from './aoi-doctor.mjs'

describe('aoi-doctor unit tests', () => {
  it('checkBinaries identifies found and missing binaries', async () => {
    const mockExec = async (cmd, args) => {
      if (args[0] === 'icm') return { stdout: '/usr/local/bin/icm\n' }
      throw new Error('not found')
    }

    const testBinaries = [
      { name: 'icm', description: 'ICM' },
      { name: 'fake-tool', description: 'Fake' },
    ]

    const results = await checkBinaries(testBinaries, mockExec)
    assert.equal(results.length, 2)
    assert.equal(results[0].status, 'PASSED')
    assert.equal(results[1].status, 'WARNING')
  })

  it('checkTaskRegistry verifies tasks correctly', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doctor-test-'))
    const tasksDir = path.join(tmpDir, '.tasks')
    fs.mkdirSync(tasksDir, { recursive: true })

    // Valid task
    const featDir = path.join(tasksDir, 'auth', 'TASK-2026-001')
    fs.mkdirSync(featDir, { recursive: true })

    fs.writeFileSync(
      path.join(tasksDir, 'registry.md'),
      '| Task ID | Feature | Title | Status |\n|---|---|---|---|\n| TASK-2026-001 | auth | Login | ✅ |\n'
    )

    const result = checkTaskRegistry(tmpDir)
    assert.equal(result.status, 'PASSED')
    assert.equal(result.taskCount, 1)

    // Missing folder task
    fs.writeFileSync(
      path.join(tasksDir, 'registry.md'),
      '| Task ID | Feature | Title | Status |\n|---|---|---|---|\n| TASK-2026-002 | payments | Pay | ✅ |\n'
    )

    const failResult = checkTaskRegistry(tmpDir)
    assert.equal(failResult.status, 'FAILED')
    assert.equal(failResult.issues.length, 1)

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('checkMemoryGovernance validates active manifest existence', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doctor-gov-'))
    const versionsDir = path.join(tmpDir, '.specify', 'memory', 'versions')
    fs.mkdirSync(path.join(versionsDir, 'manifests', 'my-ws'), { recursive: true })

    fs.writeFileSync(
      path.join(versionsDir, 'active.json'),
      JSON.stringify({
        workspaceStates: {
          'my-ws': { activeVersionId: 'v1.0.0' },
        },
      })
    )

    // Manifest missing -> FAILED
    const failRes = checkMemoryGovernance(tmpDir)
    assert.equal(failRes.status, 'FAILED')

    // Manifest created -> PASSED
    fs.writeFileSync(path.join(versionsDir, 'manifests', 'my-ws', 'v1.0.0.json'), '{}')
    const passRes = checkMemoryGovernance(tmpDir)
    assert.equal(passRes.status, 'PASSED')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('checkResourcesStructure checks constitution and subfolders', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doctor-res-'))
    const resDir = path.join(tmpDir, '.resources')
    fs.mkdirSync(path.join(resDir, 'userstories'), { recursive: true })
    fs.mkdirSync(path.join(resDir, 'workflows'), { recursive: true })
    fs.writeFileSync(path.join(resDir, 'constitution.md'), '# Constitution')

    const res = checkResourcesStructure(tmpDir)
    assert.equal(res.status, 'PASSED')

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('checkMultiHarnessRules verifies active harness rule files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-doctor-harness-'))
    const failRes = checkMultiHarnessRules(tmpDir)
    assert.equal(failRes.status, 'WARNING')

    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# Claude')
    const passRes = checkMultiHarnessRules(tmpDir)
    assert.equal(passRes.status, 'PASSED')
    assert.ok(passRes.details.includes('Claude'))

    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('runAoiDoctor returns composite health report', async () => {
    const report = await runAoiDoctor({
      execFn: async () => ({ stdout: 'All 15 ICM hook entries are healthy.' }),
    })
    assert.ok(typeof report.ok === 'boolean')
    assert.ok(report.checks.length > 5)
  })
})
