import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadGitignoreRules } from './dead-gitignore-pruner.mjs'

test('auditDeadGitignoreRules approves unique canonical rules', () => {
  const rules = ['node_modules', '.output', '*.log', '# comments are ignored']
  const result = auditDeadGitignoreRules(rules)
  assert.equal(result.clean, true)
  assert.equal(result.gitignoreProof, 'GITIGNORE_RULES_CANONICAL')
  assert.equal(result.duplicateCount, 0)
})

test('auditDeadGitignoreRules detects duplicate gitignore rules', () => {
  const rules = ['node_modules', '.output', 'node_modules']
  const result = auditDeadGitignoreRules(rules)
  assert.equal(result.clean, false)
  assert.equal(result.gitignoreProof, 'DUPLICATE_GITIGNORE_RULES_DETECTED')
  assert.equal(result.duplicateCount, 1)
  assert.equal(result.duplicates[0].rule, 'node_modules')
})
