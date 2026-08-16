import test from 'node:test'
import assert from 'node:assert/strict'
import { provePathContainment } from './sandbox-path-escape-prover.mjs'

test('provePathContainment approves paths inside sandbox root', () => {
  const root = '/workspace/.sandboxes/aoi-os-tmp-T1'
  const target = 'src/services/task.ts'
  const result = provePathContainment(root, target)
  assert.equal(result.contained, true)
  assert.equal(result.containmentProof, 'SANDBOX_PATH_CONFINEMENT_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('provePathContainment detects directory traversal escapes outside sandbox root', () => {
  const root = '/workspace/.sandboxes/aoi-os-tmp-T1'
  const target = '../../../../etc/passwd'
  const result = provePathContainment(root, target)
  assert.equal(result.contained, false)
  assert.equal(result.containmentProof, 'SANDBOX_ESCAPE_VIOLATION_DETECTED')
  assert.equal(result.violationsCount, 1)
  assert.equal(result.violations[0].type, 'SANDBOX_PATH_TRAVERSAL_ESCAPE_ATTEMPT')
})
