import test from 'node:test'
import assert from 'node:assert/strict'
import { auditAtomicParentDirFsyncSafety } from './file-atomic-parent-dir-fsync-guard.mjs'

test('auditAtomicParentDirFsyncSafety approves atomic rename with parent directory fsync flush', () => {
  const code = `
fs.renameSync(tempFile, targetFile);
const dirFd = fs.openSync(path.dirname(targetFile), 'r');
fs.fsyncSync(dirFd);
fs.closeSync(dirFd);
`
  const result = auditAtomicParentDirFsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasParentDirFsync, true)
  assert.equal(result.parentDirFsyncProof, 'PARENT_DIRECTORY_FSYNC_FLUSH_VERIFIED')
})

test('auditAtomicParentDirFsyncSafety detects atomic rename without parent directory fsync', () => {
  const code = `
fs.renameSync(tempFile, targetFile);
`
  const result = auditAtomicParentDirFsyncSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.parentDirFsyncProof, 'UNGUARDED_DIRECTORY_ENTRY_WITHOUT_PARENT_FSYNC_DETECTED')
  assert.ok(result.violations.includes('ATOMIC_RENAME_MISSING_PARENT_DIRECTORY_FSYNC_FLUSH'))
})

test('auditAtomicParentDirFsyncSafety returns safe when no rename operation is performed', () => {
  const code = `
const x = 42;
`
  const result = auditAtomicParentDirFsyncSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.parentDirFsyncProof, 'NO_ATOMIC_RENAME_OPERATION_DETECTED')
})
