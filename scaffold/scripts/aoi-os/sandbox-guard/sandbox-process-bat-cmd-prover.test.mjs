import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessBatCmdSafety } from './sandbox-process-bat-cmd-prover.mjs'

test('proveSandboxProcessBatCmdSafety approves batch file execution with sanitized arguments', () => {
  const code = `
function sanitizeBatchArg(arg) {
  return arg.replace(/["%^&|<>()]/g, '^$&');
}

const safeArgs = userArgs.map(sanitizeBatchArg);
const child = spawn('build.bat', safeArgs, { windowsVerbatimArguments: true });
`
  const result = proveSandboxProcessBatCmdSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.batchCmdProof, 'WINDOWS_BATCH_ARGS_SANITIZED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessBatCmdSafety detects raw unsanitized batch file execution', () => {
  const code = `
const child = spawn('build.bat', [userInput]);
`
  const result = proveSandboxProcessBatCmdSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.batchCmdProof, 'BATCH_FILE_COMMAND_INJECTION_RISK')
  assert.equal(result.violationsCount, 1)
})
