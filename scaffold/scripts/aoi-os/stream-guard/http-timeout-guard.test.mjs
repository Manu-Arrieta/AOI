import test from 'node:test'
import assert from 'node:assert/strict'
import { auditHttpRequestTimeoutSafety } from './http-timeout-guard.mjs'

test('auditHttpRequestTimeoutSafety approves fetch with AbortSignal timeout', () => {
  const code = `
async function fetchConfig(url) {
  return fetch(url, {
    signal: AbortSignal.timeout(5000)
  });
}
`
  const result = auditHttpRequestTimeoutSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.timeoutProof, 'HTTP_REQUEST_TIMEOUT_PROTECTED')
  assert.equal(result.violationsCount, 0)
})

test('auditHttpRequestTimeoutSafety detects unguarded fetch call', () => {
  const code = `
async function fetchConfig(url) {
  return fetch(url);
}
`
  const result = auditHttpRequestTimeoutSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.timeoutProof, 'UNGUARDED_HTTP_CALL_DETECTED')
  assert.equal(result.violationsCount, 1)
})
