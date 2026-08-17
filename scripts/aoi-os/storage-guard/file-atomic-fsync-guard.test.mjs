import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicFileFsyncSafety } from './file-atomic-fsync-guard.mjs'

test('auditAtomicFileFsyncSafety approves atomic write with explicit fsyncSync and renameSync', () => {
  const code = `
const fd = fs.openSync(tempFile, 'w');
fs.writeFileSync(fd, content);
fs.fsyncSync(fd);
fs.closeSync(fd);
fs.renameSync(tempFile, targetFile);
`
  const result = auditAtomicFileFsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasFsyncFlush, true)
  assert.equal(result.atomicFsyncProof, 'ATOMIC_FILE_FSYNC_FLUSH_VERIFIED')
})

test('auditAtomicFileFsyncSafety detects atomic rename without preceding fsync flush', () => {
  const code = `
fs.writeFileSync(tempFile, content);
fs.renameSync(tempFile, targetFile);
`
  const result = auditAtomicFileFsyncSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.atomicFsyncProof, 'UNGUARDED_ATOMIC_RENAME_WITHOUT_FSYNC_DETECTED')
  assert.ok(result.violations.includes('ATOMIC_RENAME_MISSING_EXPLICIT_FSYNC_PHYSICAL_FLUSH'))
})

test('auditAtomicFileFsyncSafety returns safe when no rename operation is present', () => {
  const code = `
console.log("No file operations here");
`
  const result = auditAtomicFileFsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.atomicFsyncProof, 'NO_ATOMIC_RENAME_OPERATION_DETECTED')
})
