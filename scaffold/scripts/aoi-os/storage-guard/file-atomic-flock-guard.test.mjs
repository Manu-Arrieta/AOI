import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicFlockSafety } from './file-atomic-flock-guard.mjs'

test('auditAtomicFlockSafety approves concurrent atomic write protected with proper-lockfile', () => {
  const code = `
async function updateRegistry(filePath, data) {
  const release = await lockfile.lock(filePath);
  try {
    fs.writeFileSync(tempPath, data);
    fs.renameSync(tempPath, filePath);
  } finally {
    await release();
  }
}
`
  const result = auditAtomicFlockSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasAdvisoryLock, true)
  assert.equal(result.atomicFlockProof, 'EXCLUSIVE_ADVISORY_LOCK_VERIFIED')
})

test('auditAtomicFlockSafety detects raw unguarded concurrent atomic update without locking', () => {
  const code = `
function updateRegistry(filePath, data) {
  fs.writeFileSync(tempPath, data);
  fs.renameSync(tempPath, filePath);
}
`
  const result = auditAtomicFlockSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.atomicFlockProof, 'UNGUARDED_CONCURRENT_FILE_MUTATION_RISK_DETECTED')
  assert.ok(result.violations.includes('CONCURRENT_ATOMIC_WRITE_MISSING_ADVISORY_LOCK_OR_EXCLUSIVE_FLAG'))
})

test('auditAtomicFlockSafety returns safe when no concurrent atomic write operation is detected', () => {
  const code = `
const answer = 42;
`
  const result = auditAtomicFlockSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.atomicFlockProof, 'NO_CONCURRENT_ATOMIC_WRITE_DETECTED')
})
