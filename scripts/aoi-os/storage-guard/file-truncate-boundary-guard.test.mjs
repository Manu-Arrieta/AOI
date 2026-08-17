import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileTruncateBoundarySafety } from './file-truncate-boundary-guard.mjs'

test('auditFileTruncateBoundarySafety approves truncate with exclusive lock or staging', () => {
  const code = `
async function truncateJournal(fd) {
  await acquireFileLock('journal.lock');
  try {
    await fs.promises.ftruncate(fd, 0);
  } finally {
    await releaseFileLock('journal.lock');
  }
}
`
  const result = auditFileTruncateBoundarySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.truncateProof, 'FILE_TRUNCATE_BOUNDARY_LOCKED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileTruncateBoundarySafety detects raw unguarded in-place truncate', () => {
  const code = `
async function clearLogFile(filePath) {
  await fs.promises.truncate(filePath, 0);
}
`
  const result = auditFileTruncateBoundarySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.truncateProof, 'UNGUARDED_TRUNCATION_RACE_RISK')
  assert.equal(result.violationsCount, 1)
})
