import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadTypeAliases } from './dead-type-alias-pruner.mjs'

test('auditDeadTypeAliases approves fully referenced type aliases', () => {
  const aliases = ['UserSummary', 'TaskFilter']
  const code = `
function render(user: UserSummary) {}
const filter = {} as TaskFilter;
`
  const result = auditDeadTypeAliases(aliases, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.aliasProof, 'ALL_TYPE_ALIASES_REFERENCED')
  assert.equal(result.deadAliasesCount, 0)
})

test('auditDeadTypeAliases detects unreferenced dead type aliases', () => {
  const aliases = ['UserSummary', 'LegacyDto']
  const code = `
function render(user: UserSummary) {}
`
  const result = auditDeadTypeAliases(aliases, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.aliasProof, 'DEAD_TYPE_ALIASES_DETECTED')
  assert.equal(result.deadAliasesCount, 1)
  assert.equal(result.deadAliases[0].aliasName, 'LegacyDto')
})
