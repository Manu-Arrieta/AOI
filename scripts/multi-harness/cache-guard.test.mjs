import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePromptCacheAlignment } from './cache-guard.mjs'

test('validatePromptCacheAlignment accepts clean static prompt prefix', () => {
  const prompt = `---
description: "Implementation prompt"
agent: "supervisor"
---
# Invariant instructions
Execute tasks in order. Always use TDD.
`
  const result = validatePromptCacheAlignment(prompt)
  assert.equal(result.valid, true)
  assert.equal(result.violations.length, 0)
})

test('validatePromptCacheAlignment flags ISO timestamps in prefix', () => {
  const prompt = `# Prompt with date: 2026-09-06T12:00:00\nExecute tasks.`
  const result = validatePromptCacheAlignment(prompt)
  assert.equal(result.valid, false)
  assert.match(result.violations[0], /ISO Timestamp Injection/)
})

test('validatePromptCacheAlignment allows dynamic timestamps in the suffix (after prefix boundary)', () => {
  const longStaticPrefix = 'A'.repeat(1600)
  const prompt = `${longStaticPrefix}\nTimestamp: 2026-09-06T12:00:00`
  const result = validatePromptCacheAlignment(prompt, { prefixLength: 1500 })
  assert.equal(result.valid, true)
})
