import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileAppendLockSafety } from './file-append-lock-guard.mjs'

test('auditFileAppendLockSafety approves file append protected by queue/mutex', () => {
  const code = `
class JournalLogger {
  constructor() {
    this.writeQueue = Promise.resolve();
  }

  async append(entry) {
    this.writeQueue = this.writeQueue.then(async () => {
      await fs.promises.appendFile('/logs/audit.log', entry + '\\n');
    });
    return this.writeQueue;
  }
}
`
  const result = auditFileAppendLockSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.appendLockProof, 'FILE_APPEND_CONCURRENCY_LOCKED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileAppendLockSafety detects raw unprotected concurrent async append', () => {
  const code = `
async function logMessage(msg) {
  await fs.promises.appendFile('/logs/audit.log', msg + '\\n');
}
`
  const result = auditFileAppendLockSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.appendLockProof, 'INTERLEAVED_APPEND_CORRUPTION_RISK')
  assert.equal(result.violationsCount, 1)
})
