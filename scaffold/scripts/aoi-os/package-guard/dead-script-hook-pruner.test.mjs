import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadScriptHooks } from './dead-script-hook-pruner.mjs'

test('auditDeadScriptHooks approves valid lifecycle hook referencing existing script', () => {
  const pkg = {
    scripts: {
      prepare: 'pnpm run build',
      build: 'tsc -b',
    },
  }
  const result = auditDeadScriptHooks(pkg, ['build'])
  assert.equal(result.clean, true)
  assert.equal(result.hookProof, 'LIFECYCLE_HOOKS_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadScriptHooks detects dead lifecycle hook referencing non-existent script', () => {
  const pkg = {
    scripts: {
      postinstall: 'npm run setup:legacy',
      build: 'tsc -b',
    },
  }
  const result = auditDeadScriptHooks(pkg, ['build'])
  assert.equal(result.clean, false)
  assert.equal(result.hookProof, 'DEAD_LIFECYCLE_HOOKS_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadHooks[0].missingTarget, 'setup:legacy')
})
