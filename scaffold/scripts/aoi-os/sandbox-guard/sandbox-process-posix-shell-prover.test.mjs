import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessPosixShellSafety } from './sandbox-process-posix-shell-prover.mjs'

test('proveSandboxProcessPosixShellSafety approves POSIX command with quoted variables', () => {
  const code = `
const child = spawn('/bin/sh', ['-c', 'rm -rf "$TARGET_DIR"']);
`
  const result = proveSandboxProcessPosixShellSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.posixShellProof, 'POSIX_SHELL_VARIABLES_PROPERLY_QUOTED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessPosixShellSafety detects POSIX command with unquoted variable expansion', () => {
  const code = `
const child = spawn('/bin/sh', ['-c', 'rm -rf $TARGET_DIR']);
`
  const result = proveSandboxProcessPosixShellSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.posixShellProof, 'UNQUOTED_SHELL_VARIABLE_WORD_SPLITTING_RISK')
  assert.equal(result.violationsCount, 1)
})
