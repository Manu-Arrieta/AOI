import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxCoreDumpSafety } from './sandbox-coredump-prover.mjs'

test('proveSandboxCoreDumpSafety approves subprocess with core dump disabled', () => {
  const code = `
function launchSandboxProcess(cmd) {
  return exec(\`ulimit -c 0 && \${cmd}\`);
}
`
  const result = proveSandboxCoreDumpSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.coreDumpProof, 'SANDBOX_CORE_DUMP_DISABLED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxCoreDumpSafety detects subprocess without core dump disabled', () => {
  const code = `
function launchSandboxProcess(cmd) {
  return exec(cmd);
}
`
  const result = proveSandboxCoreDumpSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.coreDumpProof, 'POTENTIAL_MEMORY_LEAK_CORE_DUMP')
  assert.equal(result.violationsCount, 1)
})
