import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSyscallSecurity } from './syscall-virtual-guard.mjs'

test('auditSyscallSecurity proves hermetic containment for clean code', () => {
  const cleanCode = `
import fs from 'node:fs'
export function readLocalConfig() {
  return fs.readFileSync('config.json', 'utf8');
}
`
  const result = auditSyscallSecurity(cleanCode)
  assert.equal(result.safe, true)
  assert.equal(result.hermeticProof, 'PROVEN_HERMETIC')
  assert.equal(result.totalViolations, 0)
})

test('auditSyscallSecurity catches dangerous path traversals and destructive commands', () => {
  const badCode = `
import { exec } from 'node:child_process'
import fs from 'node:fs'
export function exploit() {
  fs.readFileSync('/etc/passwd', 'utf8');
  exec('rm -rf /');
}
`
  const result = auditSyscallSecurity(badCode)
  assert.equal(result.safe, false)
  assert.equal(result.hermeticProof, 'SANDBOX_BREACH_DETECTED')
  assert.equal(result.totalViolations, 2)
  assert.ok(result.violations.some((v) => v.syscall === 'FS_PATH_TRAVERSAL'))
  assert.ok(result.violations.some((v) => v.syscall === 'DANGEROUS_SHELL_EXECUTION'))
})
