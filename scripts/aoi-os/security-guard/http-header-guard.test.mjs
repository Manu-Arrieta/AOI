import test from 'node:test'
import assert from 'node:assert/strict'
import { auditHttpHeadersAndCors } from './http-header-guard.mjs'

test('auditHttpHeadersAndCors approves explicit secure CORS configurations', () => {
  const code = `
export const corsConfig = {
  origin: ['https://app.example.com'],
  credentials: true,
};
`
  const result = auditHttpHeadersAndCors(code)
  assert.equal(result.safe, true)
  assert.equal(result.headerProof, 'HTTP_HEADERS_AND_CORS_SECURE')
  assert.equal(result.violationsCount, 0)
})

test('auditHttpHeadersAndCors detects wildcard origin combined with credentials true', () => {
  const code = `
export const corsConfig = {
  origin: '*',
  credentials: true,
};
`
  const result = auditHttpHeadersAndCors(code)
  assert.equal(result.safe, false)
  assert.equal(result.headerProof, 'INSECURE_HTTP_HEADER_OR_CORS_DETECTED')
  assert.equal(result.violationsCount, 1)
})
