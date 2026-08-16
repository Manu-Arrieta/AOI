import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxTempCleanupSafety } from './sandbox-temp-cleanup-prover.mjs'

test('proveSandboxTempCleanupSafety approves temporary directory creation with guaranteed recursive cleanup', () => {
  const code = `
const tmp = fs.mkdtempSync('/tmp/sandbox-');
try {
  doWork(tmp);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
`
  const result = proveSandboxTempCleanupSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.cleanupProof, 'TEMP_DIRECTORY_CLEANUP_GUARANTEED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxTempCleanupSafety detects temp directory creation without recursive cleanup', () => {
  const code = `
const tmp = fs.mkdtempSync('/tmp/sandbox-');
doWork(tmp);
`
  const result = proveSandboxTempCleanupSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.cleanupProof, 'UNSAFE_LINGERING_TEMP_DIRECTORY_RISK')
  assert.equal(result.violationsCount, 1)
})
