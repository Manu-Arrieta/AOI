import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessWindowsHideSafety } from './sandbox-process-windows-hide-prover.mjs'

test('proveSandboxProcessWindowsHideSafety approves child process spawn with windowsHide: true', () => {
  const code = `
const child = spawn('node', ['worker.js'], {
  cwd: '/sandbox',
  windowsHide: true,
});
`
  const result = proveSandboxProcessWindowsHideSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.windowsHideProof, 'CROSS_PLATFORM_HEADLESS_PROCESS_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessWindowsHideSafety detects child process spawn missing windowsHide', () => {
  const code = `
const child = spawn('node', ['worker.js'], {
  cwd: '/sandbox',
});
`
  const result = proveSandboxProcessWindowsHideSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.windowsHideProof, 'POPUP_WINDOW_PROCESS_RISK')
  assert.equal(result.violationsCount, 1)
})
