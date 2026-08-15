import test from 'node:test'
import assert from 'node:assert/strict'
import { synthesizeE2eTestFlow } from './e2e-flow-synthesizer.mjs'

test('synthesizeE2eTestFlow creates valid Vitest integration test suite from task routes', () => {
  const tasks = [
    { id: 'T-1', title: 'Task Endpoint', targetFiles: ['server/api/tasks/_taskId_.get.ts'] },
    { id: 'T-2', title: 'Control Endpoint', targetFiles: ['server/api/aoi-os/control.post.ts'] },
  ]

  const output = synthesizeE2eTestFlow(tasks, { suiteName: 'AOI-OS E2E Flow' })
  assert.ok(output.includes("describe('AOI-OS E2E Flow'"))
  assert.ok(output.includes("GET /api/tasks/{taskId}"))
  assert.ok(output.includes("POST /api/aoi-os/control"))
  assert.ok(output.includes("expect(res).toBeDefined()"))
})
