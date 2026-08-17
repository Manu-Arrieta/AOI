import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxStdioFlushSafety } from './sandbox-stdio-flush-prover.mjs'

test('proveSandboxStdioFlushSafety approves process runner listening on close event', () => {
  const code = `
function runSandboxProcess(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.on('close', (code) => {
      resolve({ code, output });
    });
  });
}
`
  const result = proveSandboxStdioFlushSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.flushProof, 'COMPLETE_STDIO_STREAM_FLUSH_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxStdioFlushSafety detects premature resolution on exit event before stdio flush', () => {
  const code = `
function runSandboxProcess(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args);
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.on('exit', (code) => {
      resolve({ code, output });
    });
  });
}
`
  const result = proveSandboxStdioFlushSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.flushProof, 'PREMATURE_EXIT_LOG_TRUNCATION_RISK')
  assert.equal(result.violationsCount, 1)
})
