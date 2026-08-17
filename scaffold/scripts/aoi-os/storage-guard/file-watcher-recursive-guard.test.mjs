import test from 'node:test'
import assert from 'node:assert/strict'
import { auditFileWatcherRecursiveSafety } from './file-watcher-recursive-guard.mjs'

test('auditFileWatcherRecursiveSafety approves recursive watcher with platform guard or chokidar', () => {
  const code = `
if (process.platform === 'linux') {
  // Use directory walker
  watchDirectoryTree(targetPath);
} else {
  fs.watch(targetPath, { recursive: true }, handler);
}
`
  const result = auditFileWatcherRecursiveSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.watcherRecursiveProof, 'FILE_WATCHER_RECURSIVE_PLATFORM_COMPLIANT')
  assert.equal(result.violationsCount, 0)
})

test('auditFileWatcherRecursiveSafety detects unguarded native recursive fs.watch', () => {
  const code = `
const watcher = fs.watch('/workspace', { recursive: true }, (event, filename) => {
  console.log(event, filename);
});
`
  const result = auditFileWatcherRecursiveSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.watcherRecursiveProof, 'NATIVE_RECURSIVE_WATCHER_LINUX_UNSUPPORTED')
  assert.equal(result.violationsCount, 1)
})
