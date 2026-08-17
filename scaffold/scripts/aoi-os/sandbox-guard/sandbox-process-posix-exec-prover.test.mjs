import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessPosixExecSafety } from './sandbox-process-posix-exec-prover.mjs'

test('proveSandboxProcessPosixExecSafety approves direct execFile execution', () => {
  const code = `
const child = child_process.execFile('/usr/bin/git', ['status', '--porcelain'], (err, stdout) => {
  console.log(stdout);
});
`
  const result = proveSandboxProcessPosixExecSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.posixExecProof, 'DIRECT_BINARY_EXECUTION_VERIFIED')
})

test('proveSandboxProcessPosixExecSafety approves direct spawn with argument array', () => {
  const code = `
const child = spawn('node', ['scripts/test.mjs'], { stdio: 'inherit' });
`
  const result = proveSandboxProcessPosixExecSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.posixExecProof, 'DIRECT_BINARY_EXECUTION_VERIFIED')
})

test('proveSandboxProcessPosixExecSafety detects dangerous string interpolated exec call', () => {
  const code = `
const child = child_process.exec(\`git checkout \${branchName}\`);
`
  const result = proveSandboxProcessPosixExecSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.posixExecProof, 'VULNERABLE_SUBSHELL_STRING_EXECUTION_DETECTED')
  assert.ok(result.violations.includes('DANGEROUS_RAW_SHELL_EXEC_USED_INSTEAD_OF_DIRECT_EXECFILE'))
})
