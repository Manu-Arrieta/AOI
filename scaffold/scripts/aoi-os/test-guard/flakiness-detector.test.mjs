import test from 'node:test'
import assert from 'node:assert/strict'
import { auditTestFlakiness } from './flakiness-detector.mjs'

test('auditTestFlakiness detects hardcoded timeouts and unseeded random calls', () => {
  const flakyTest = `
import { test, expect } from 'vitest'

test('flaky api test', async () => {
  const randomId = Math.random();
  await new Promise(r => setTimeout(r, 500));
  expect(randomId).toBeDefined();
})
`
  const result = auditTestFlakiness(flakyTest, 'api.test.ts')
  assert.equal(result.deterministic, false)
  assert.ok(result.findings.some((f) => f.indicatorId === 'HARDCODED_TIMER'))
  assert.ok(result.findings.some((f) => f.indicatorId === 'NON_DETERMINISTIC_RANDOM'))
  assert.ok(result.riskScore >= 45)
})

test('auditTestFlakiness passes fully deterministic tests', () => {
  const deterministicTest = `
import { test, expect } from 'vitest'

test('pure deterministic test', () => {
  const fixture = { id: 1, name: 'Alice' };
  expect(fixture.name).toBe('Alice');
})
`
  const result = auditTestFlakiness(deterministicTest, 'pure.test.ts')
  assert.equal(result.deterministic, true)
  assert.equal(result.findings.length, 0)
  assert.equal(result.riskScore, 0)
})
