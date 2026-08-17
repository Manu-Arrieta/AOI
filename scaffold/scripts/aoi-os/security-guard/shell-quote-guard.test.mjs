import test from 'node:test'
import assert from 'node:assert/strict'
import { auditShellQuoteSafety } from './shell-quote-guard.mjs'

test('auditShellQuoteSafety approves escaped shell command interpolation', () => {
  const code = `
function runGitCommand(branchName) {
  const safeBranch = escapeShellArg(branchName);
  return execSync(\`git checkout \${safeBranch}\`);
}
`
  const result = auditShellQuoteSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.shellProof, 'SHELL_COMMAND_QUOTING_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditShellQuoteSafety detects unquoted raw shell interpolation', () => {
  const code = `
function runGitCommand(branchName) {
  return execSync(\`git checkout \${branchName}\`);
}
`
  const result = auditShellQuoteSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.shellProof, 'SHELL_INJECTION_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
