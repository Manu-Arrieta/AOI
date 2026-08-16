import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadComponents } from './dead-component-pruner.mjs'

test('auditDeadComponents approves fully rendered components', () => {
  const components = ['TaskBoard', 'TaskTanstackTable']
  const appTemplate = `
<template>
  <main>
    <TaskBoard />
    <task-tanstack-table />
  </main>
</template>
`
  const result = auditDeadComponents(components, appTemplate)
  assert.equal(result.allRendered, true)
  assert.equal(result.componentProof, 'ALL_DECLARED_COMPONENTS_RENDERED')
  assert.equal(result.deadComponentsCount, 0)
})

test('auditDeadComponents detects unrendered dead components', () => {
  const components = ['TaskBoard', 'LegacyModal']
  const appTemplate = `
<template>
  <main>
    <TaskBoard />
  </main>
</template>
`
  const result = auditDeadComponents(components, appTemplate)
  assert.equal(result.allRendered, false)
  assert.equal(result.componentProof, 'DEAD_UNRENDERED_COMPONENTS_DETECTED')
  assert.equal(result.deadComponentsCount, 1)
  assert.equal(result.deadComponents[0].component, 'LegacyModal')
})
