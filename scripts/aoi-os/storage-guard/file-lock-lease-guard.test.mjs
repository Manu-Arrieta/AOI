import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileLockLeaseSafety } from './file-lock-lease-guard.mjs'

test('auditFileLockLeaseSafety approves lockfile with stale PID verification', () => {
  const code = `
function acquireLock(lockPath) {
  if (fs.existsSync(lockPath)) {
    const pid = parseInt(fs.readFileSync(lockPath, 'utf8'), 10);
    try {
      process.kill(pid, 0);
      throw new Error('Locked by active process');
    } catch (e) {
      if (e.code === 'ESRCH') fs.unlinkSync(lockPath);
    }
  }
  fs.writeFileSync(lockPath, String(process.pid));
}
`
  const result = auditFileLockLeaseSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.lockLeaseProof, 'FILE_LOCK_LEASE_EXPIRATION_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileLockLeaseSafety detects unguarded lockfile creation without stale check', () => {
  const code = `
function acquireLock(lockPath) {
  if (fs.existsSync(lockPath)) {
    throw new Error('Lockfile already exists: ' + lockPath);
  }
  fs.writeFileSync(lockPath, String(process.pid));
}
`
  const result = auditFileLockLeaseSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.lockLeaseProof, 'STALE_LOCK_DEADLOCK_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
