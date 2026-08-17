import test from 'node:test'
import assert from 'node:assert/strict'
import { auditBrowserStorageQuotaSafety } from './browser-storage-quota-guard.mjs'

test('auditBrowserStorageQuotaSafety approves localStorage write wrapped in try-catch', () => {
  const code = `
function saveToken(token) {
  try {
    localStorage.setItem('auth_token', token);
  } catch (err) {
    console.warn('Storage quota exceeded', err);
  }
}
`
  const result = auditBrowserStorageQuotaSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.storageProof, 'BROWSER_STORAGE_QUOTA_SAFE')
  assert.equal(result.violationsCount, 0)
})

test('auditBrowserStorageQuotaSafety detects raw unguarded localStorage write', () => {
  const code = `
function saveToken(token) {
  localStorage.setItem('auth_token', token);
}
`
  const result = auditBrowserStorageQuotaSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.storageProof, 'UNGUARDED_STORAGE_WRITE_DETECTED')
  assert.equal(result.violationsCount, 1)
})
