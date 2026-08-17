import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessWindowsBatchEscapeSafety } from './sandbox-process-windows-batch-escape-prover.mjs'

test('proveSandboxProcessWindowsBatchEscapeSafety approves batch execution with escapeBatchArg', () => {
  const code = `
function escapeBatchArg(arg) {
  return arg.replace(/([\\^&|<>\'%"])/g, '^$1');
}

const safeArgs = rawArgs.map(escapeBatchArg);
const child = spawn('build.bat', safeArgs, { windowsVerbatimArguments: true });
`
  const result = proveSandboxProcessWindowsBatchEscapeSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.batchEscapeProof, 'WINDOWS_BATCH_METACHARACTERS_ESCAPED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessWindowsBatchEscapeSafety detects raw unescaped batch execution', () => {
  const code = `
const child = spawn('deploy.cmd', rawArgs, { windowsVerbatimArguments: true });
`
  const result = proveSandboxProcessWindowsBatchEscapeSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.batchEscapeProof, 'UNESCAPED_BATCH_METACHARACTER_RISK')
  assert.equal(result.violationsCount, 1)
})
