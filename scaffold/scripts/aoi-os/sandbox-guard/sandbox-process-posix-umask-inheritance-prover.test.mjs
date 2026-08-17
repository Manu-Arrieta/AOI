import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessPosixUmaskSafety } from './sandbox-process-posix-umask-inheritance-prover.mjs'

test('proveSandboxProcessPosixUmaskSafety approves worker setup with explicit process.umask', () => {
  const code = `
process.umask(0o077);
const child = spawn('node', ['worker.mjs'], { stdio: 'pipe' });
`
  const result = proveSandboxProcessPosixUmaskSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.posixUmaskProof, 'POSIX_UMASK_ISOLATION_VERIFIED')
})

test('proveSandboxProcessPosixUmaskSafety detects process spawn without umask isolation', () => {
  const code = `
const child = spawn('node', ['worker.mjs'], { stdio: 'pipe' });
`
  const result = proveSandboxProcessPosixUmaskSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.posixUmaskProof, 'PERMISSIVE_HOST_UMASK_INHERITANCE_RISK_DETECTED')
  assert.ok(result.violations.includes('PROCESS_SPAWN_MISSING_EXPLICIT_POSIX_UMASK_ISOLATION'))
})

test('proveSandboxProcessPosixUmaskSafety returns safe when no process spawn exists', () => {
  const code = `
const a = 10;
`
  const result = proveSandboxProcessPosixUmaskSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.posixUmaskProof, 'NO_PROCESS_SPAWN_DETECTED')
})
