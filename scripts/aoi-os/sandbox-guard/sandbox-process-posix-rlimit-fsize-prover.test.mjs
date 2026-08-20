import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessRlimitFsizeSafety } from './sandbox-process-posix-rlimit-fsize-prover.mjs'

test('proveSandboxProcessRlimitFsizeSafety approves sandbox spawn with ulimit -f limit', () => {
  const code = `
function spawnSandbox(scriptPath, args) {
  const child = spawn('sh', ['-c', 'ulimit -f 50000 && node ' + scriptPath], {
    maxDiskQuotaMb: 50,
  });
  return child;
}
`
  const result = proveSandboxProcessRlimitFsizeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasFsizeLimit, true)
  assert.equal(result.rlimitFsizeProof, 'SANDBOX_RLIMIT_FSIZE_BOUND_VERIFIED')
})

test('proveSandboxProcessRlimitFsizeSafety detects sandbox spawn missing file size limit', () => {
  const code = `
function spawnSandbox(scriptPath, args) {
  const child = spawn('node', [scriptPath]);
  return child;
}
`
  const result = proveSandboxProcessRlimitFsizeSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.rlimitFsizeProof, 'UNBOUNDED_DISK_WRITE_FSIZE_RISK_DETECTED')
  assert.ok(result.violations.includes('SANDBOX_SPAWN_MISSING_EXPLICIT_RLIMIT_FSIZE_BOUND'))
})

test('proveSandboxProcessRlimitFsizeSafety returns safe when no sandbox spawn is detected', () => {
  const code = `
const data = "regular script execution";
`
  const result = proveSandboxProcessRlimitFsizeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.rlimitFsizeProof, 'NO_SANDBOX_SPAWN_OPERATION_DETECTED')
})
