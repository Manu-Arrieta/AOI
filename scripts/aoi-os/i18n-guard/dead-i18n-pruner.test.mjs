import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadI18nKeys } from './dead-i18n-pruner.mjs'

test('auditDeadI18nKeys approves fully referenced localization keys', () => {
  const keys = ['common.confirm', 'dashboard.title']
  const code = `
<template>
  <h1>{{ $t('dashboard.title') }}</h1>
  <button>{{ t('common.confirm') }}</button>
</template>
`
  const result = auditDeadI18nKeys(keys, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.i18nProof, 'ALL_I18N_KEYS_REFERENCED')
  assert.equal(result.deadKeysCount, 0)
})

test('auditDeadI18nKeys detects unreferenced dead translation keys', () => {
  const keys = ['common.confirm', 'legacy.deleted']
  const code = `
<template>
  <button>{{ t('common.confirm') }}</button>
</template>
`
  const result = auditDeadI18nKeys(keys, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.i18nProof, 'DEAD_I18N_KEYS_DETECTED')
  assert.equal(result.deadKeysCount, 1)
  assert.equal(result.deadKeys[0].key, 'legacy.deleted')
})
