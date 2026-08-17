import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessWindowsShellSafety } from './sandbox-process-windows-shell-prover.mjs'

test('proveSandboxProcessWindowsShellSafety approves array args spawn without shell: true', () => {
  const code = `
const child = spawn('git', ['log', '-n', '5'], { shell: false });
`
  const result = proveSandboxProcessWindowsShellSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.windowsShellProof, 'SHELL_INJECTION_DEFENSE_PROVED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessWindowsShellSafety detects shell: true with template literal interpolation', () => {
  const code = `
const child = spawn(\`echo \${userInput}\`, [], { shell: true });
`
  const result = proveSandboxProcessWindowsShellSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.windowsShellProof, 'SHELL_TRUE_DYNAMIC_INJECTION_RISK')
  assert.equal(result.violationsCount, 1)
})
