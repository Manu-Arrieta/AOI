import test from 'node:test'
import assert from 'node:assert/strict'
import { auditHtmlSanitizationSafety } from './html-sanitization-guard.mjs'

test('auditHtmlSanitizationSafety approves sanitized v-html binding', () => {
  const code = `
<template>
  <div v-html="DOMPurify.sanitize(userContent)"></div>
</template>
`
  const result = auditHtmlSanitizationSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.xssProof, 'HTML_SANITIZATION_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditHtmlSanitizationSafety detects unsanitized innerHTML assignment', () => {
  const code = `
function renderUserBio(el, rawBio) {
  el.innerHTML = rawBio;
}
`
  const result = auditHtmlSanitizationSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.xssProof, 'UNSANITIZED_HTML_XSS_RISK_DETECTED')
  assert.equal(result.violationsCount, 1)
})
