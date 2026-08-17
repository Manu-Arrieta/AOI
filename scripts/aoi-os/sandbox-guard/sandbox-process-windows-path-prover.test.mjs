import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxProcessWindowsPathSafety } from './sandbox-process-windows-path-prover.mjs'

test('proveSandboxProcessWindowsPathSafety approves spawn with path.resolve normalization', () => {
  const code = `
const targetBin = path.resolve(__dirname, './bin/runner.exe');
const child = spawn(targetBin, [], { cwd: path.resolve('/sandbox') });
`
  const result = proveSandboxProcessWindowsPathSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.windowsPathProof, 'CROSS_PLATFORM_SPAWN_PATH_NORMALIZED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxProcessWindowsPathSafety detects raw unnormalized path literal in spawn', () => {
  const code = `
const child = spawn('./bin/runner.exe', []);
`
  const result = proveSandboxProcessWindowsPathSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.windowsPathProof, 'UNNORMALIZED_SPAWN_PATH_RISK')
  assert.equal(result.violationsCount, 1)
})
