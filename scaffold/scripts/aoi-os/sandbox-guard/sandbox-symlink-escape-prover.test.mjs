import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSymlinkContainment } from './sandbox-symlink-escape-prover.mjs'

test('proveSymlinkContainment approves symlink target contained inside sandbox root', () => {
  const root = '/workspace/.sandboxes/aoi-os-tmp-task1'
  const target = 'src/utils.ts'
  const result = proveSymlinkContainment(root, target)
  assert.equal(result.contained, true)
  assert.equal(result.symlinkProof, 'SYMLINK_CONFINEMENT_PROVEN')
})

test('proveSymlinkContainment detects symlink target escaping outside sandbox root', () => {
  const root = '/workspace/.sandboxes/aoi-os-tmp-task1'
  const target = '../../../etc/passwd'
  const result = proveSymlinkContainment(root, target)
  assert.equal(result.contained, false)
  assert.equal(result.symlinkProof, 'UNSAFE_SYMLINK_ESCAPE_DETECTED')
})
