import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileWatcherDebounceSafety } from './file-watcher-debounce-guard.mjs'

test('auditFileWatcherDebounceSafety approves debounced watcher with close teardown', () => {
  const code = `
let timer = null;
const watcher = fs.watch('/src', (event, filename) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    handleFileChange(filename);
  }, 200);
});

function teardown() {
  watcher.close();
}
`
  const result = auditFileWatcherDebounceSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.watcherProof, 'FILE_WATCHER_DEBOUNCED_AND_DISPOSED')
  assert.equal(result.violationsCount, 0)
})

test('auditFileWatcherDebounceSafety detects watcher missing debounce and teardown', () => {
  const code = `
const watcher = fs.watch('/src', (event, filename) => {
  handleFileChange(filename);
});
`
  const result = auditFileWatcherDebounceSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.watcherProof, 'WATCHER_BURST_LEAK_RISK')
  assert.equal(result.violationsCount, 2)
})
