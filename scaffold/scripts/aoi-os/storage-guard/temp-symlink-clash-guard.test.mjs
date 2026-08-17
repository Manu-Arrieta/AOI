import test from 'node:test'
import assert from 'node:assert/strict'
import { auditTempSymlinkClashSafety } from './temp-symlink-clash-guard.mjs'

test('auditTempSymlinkClashSafety approves symlink creation with random nonce and unlink', () => {
  const code = `
function createAtomicSymlink(target, linkDir) {
  const tempLink = path.join(linkDir, \`.staging-\${crypto.randomUUID()}\`);
  if (fs.existsSync(tempLink)) fs.unlinkSync(tempLink);
  fs.symlinkSync(target, tempLink);
  fs.renameSync(tempLink, path.join(linkDir, 'current'));
}
`
  const result = auditTempSymlinkClashSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.symlinkProof, 'SAFE_ATOMIC_SYMLINK_CREATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditTempSymlinkClashSafety detects predictable static temp symlink without nonce or unlink', () => {
  const code = `
function createAtomicSymlink(target) {
  fs.symlinkSync(target, '/tmp/staging-link.tmp');
}
`
  const result = auditTempSymlinkClashSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.symlinkProof, 'PREDICTABLE_SYMLINK_TOCTOU_COLLISION_RISK')
  assert.equal(result.violationsCount, 1)
})
