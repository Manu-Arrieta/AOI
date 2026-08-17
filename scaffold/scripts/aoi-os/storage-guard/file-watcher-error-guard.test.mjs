import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileWatcherErrorSafety } from './file-watcher-error-guard.mjs'

test('auditFileWatcherErrorSafety approves watcher with error event listener', () => {
  const code = `
const watcher = fs.watch(watchDir, (eventType, filename) => {
  handleFileChange(filename);
});

watcher.on('error', (err) => {
  logger.error('File watcher failure:', err);
});
`
  const result = auditFileWatcherErrorSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.watcherErrorProof, 'WATCHER_ERROR_HANDLER_VERIFIED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileWatcherErrorSafety detects watcher missing error event listener', () => {
  const code = `
const watcher = fs.watch(watchDir, (eventType, filename) => {
  handleFileChange(filename);
});
`
  const result = auditFileWatcherErrorSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.watcherErrorProof, 'UNHANDLED_WATCHER_ERROR_CRASH_RISK')
  assert.equal(result.violationsCount, 1)
})
