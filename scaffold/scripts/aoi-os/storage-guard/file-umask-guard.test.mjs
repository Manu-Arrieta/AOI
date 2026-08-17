import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileUmaskSafety } from './file-umask-guard.mjs'

test('auditFileUmaskSafety approves private key write with mode 0o600', () => {
  const code = `
function savePrivateKey(keyPath, secretData) {
  fs.writeFileSync(keyPath, secretData, { mode: 0o600 });
}
`
  const result = auditFileUmaskSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.umaskProof, 'RESTRICTIVE_FILE_PERMISSIONS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileUmaskSafety detects sensitive key write without mode or umask', () => {
  const code = `
function savePrivateKey(keyPath, secretData) {
  fs.writeFileSync(keyPath, secretData);
}
`
  const result = auditFileUmaskSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.umaskProof, 'WORLD_READABLE_SECRET_FILE_RISK')
  assert.equal(result.violationsCount, 1)
})
