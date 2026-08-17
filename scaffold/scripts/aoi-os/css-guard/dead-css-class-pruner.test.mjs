import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadCssClasses } from './dead-css-class-pruner.mjs'

test('auditDeadCssClasses approves fully referenced custom CSS classes', () => {
  const classes = ['custom-badge', 'hero-title']
  const code = `
<template>
  <div class="custom-badge">
    <h1 class="hero-title">Welcome</h1>
  </div>
</template>
`
  const result = auditDeadCssClasses(classes, code)
  assert.equal(result.allReferenced, true)
  assert.equal(result.cssClassProof, 'ALL_CSS_CLASSES_REFERENCED')
  assert.equal(result.deadClassesCount, 0)
})

test('auditDeadCssClasses detects unreferenced dead CSS classes', () => {
  const classes = ['custom-badge', 'obsolete-footer-btn']
  const code = `
<template>
  <div class="custom-badge"></div>
</template>
`
  const result = auditDeadCssClasses(classes, code)
  assert.equal(result.allReferenced, false)
  assert.equal(result.cssClassProof, 'DEAD_CSS_CLASSES_DETECTED')
  assert.equal(result.deadClassesCount, 1)
  assert.equal(result.deadClasses[0].className, 'obsolete-footer-btn')
})
