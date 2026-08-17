import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicFileWriteSafety } from './atomic-file-write-guard.mjs'

test('auditAtomicFileWriteSafety approves atomic staged write with renameSync', () => {
  const code = `
function saveManifestSnapshot(targetPath, data) {
  const tmpPath = targetPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, targetPath);
}
`
  const result = auditAtomicFileWriteSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.atomicProof, 'ATOMIC_FILE_WRITES_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditAtomicFileWriteSafety detects direct un-staged snapshot write', () => {
  const code = `
function saveManifestSnapshot(targetPath, data) {
  fs.writeFileSync(targetPath, JSON.stringify(data));
}
`
  const result = auditAtomicFileWriteSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.atomicProof, 'NON_ATOMIC_WRITE_CORRUPTION_RISK')
  assert.equal(result.violationsCount, 1)
})
