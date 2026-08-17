import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadConfigAliases } from './dead-alias-pruner.mjs'

test('auditDeadConfigAliases approves fully referenced path aliases', () => {
  const aliases = ['@components/*', '@utils/*']
  const codebase = `
import Button from '@components/Button.vue';
import { formatDate } from '@utils/date.ts';
`
  const result = auditDeadConfigAliases(aliases, codebase)
  assert.equal(result.clean, true)
  assert.equal(result.aliasProof, 'CONFIG_ALIASES_CANONICAL')
  assert.equal(result.deadCount, 0)
})

test('auditDeadConfigAliases detects orphan unreferenced path alias', () => {
  const aliases = ['@components/*', '@deprecated-legacy/*']
  const codebase = `
import Button from '@components/Button.vue';
`
  const result = auditDeadConfigAliases(aliases, codebase)
  assert.equal(result.clean, false)
  assert.equal(result.aliasProof, 'DEAD_CONFIG_ALIASES_DETECTED')
  assert.equal(result.deadCount, 1)
  assert.equal(result.deadAliases[0].alias, '@deprecated-legacy/*')
})
