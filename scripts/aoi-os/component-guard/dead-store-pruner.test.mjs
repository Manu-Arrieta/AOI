import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadStoreState } from './dead-store-pruner.mjs'

test('auditDeadStoreState approves fully referenced store state properties', () => {
  const props = ['activeTab', 'taskFilter']
  const code = `
<template>
  <div v-if="store.activeTab === 'all'">
    <span>{{ store.taskFilter }}</span>
  </div>
</template>
`
  const result = auditDeadStoreState(props, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.storeProof, 'ALL_STORE_PROPERTIES_REFERENCED')
  assert.equal(result.deadPropertiesCount, 0)
})

test('auditDeadStoreState detects unreferenced dead store state properties', () => {
  const props = ['activeTab', 'obsoleteCounter']
  const code = `
<template>
  <div v-if="store.activeTab === 'all'"></div>
</template>
`
  const result = auditDeadStoreState(props, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.storeProof, 'DEAD_STORE_PROPERTIES_DETECTED')
  assert.equal(result.deadPropertiesCount, 1)
  assert.equal(result.deadProperties[0].property, 'obsoleteCounter')
})
