import test from 'node:test'
import assert from 'node:assert/strict'
import { auditA11yTemplateCompliance } from './a11y-template-guard.mjs'

test('auditA11yTemplateCompliance approves accessible HTML / Vue template', () => {
  const template = `
<template>
  <div>
    <img src="/logo.png" alt="Company Logo" />
    <label for="username">Username</label>
    <input id="username" type="text" />
    <button @click="submit">Submit</button>
    <div role="button" tabindex="0" @click="toggleDrawer">Custom Drawer Toggle</div>
  </div>
</template>
`
  const result = auditA11yTemplateCompliance(template)
  assert.equal(result.safe, true)
  assert.equal(result.a11yProof, 'A11Y_WCAG_TEMPLATE_COMPLIANCE_VERIFIED')
  assert.equal(result.violations.length, 0)
})

test('auditA11yTemplateCompliance detects missing img alt and un-accessible clickable div', () => {
  const template = `
<template>
  <div>
    <img src="/banner.png" />
    <div @click="brokenClick">Click me</div>
  </div>
</template>
`
  const result = auditA11yTemplateCompliance(template)
  assert.equal(result.safe, false)
  assert.equal(result.a11yProof, 'A11Y_ACCESSIBILITY_VIOLATION_DETECTED')
  assert.ok(result.violations.some((v) => v.includes('A11Y_MISSING_IMG_ALT')))
  assert.ok(result.violations.some((v) => v.includes('A11Y_NON_SEMANTIC_CLICKABLE')))
})
