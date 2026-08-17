import test from 'node:test'
import assert from 'node:assert/strict'
import { auditUserIntentDrift } from './user-intent-drift-sentinel.mjs'

test('auditUserIntentDrift proves high alignment between spec intent and code', () => {
  const spec = `
# Feature: Order Checkout
Operators need to process payments, compute sales tax, and issue receipts.
`
  const code = `
export function processOrderCheckout(order) {
  const tax = computeSalesTax(order.amount);
  const payment = processPayments(order.paymentMethod);
  const receipt = issueReceipts(order.id, payment);
  return receipt;
}
`
  const result = auditUserIntentDrift(spec, code)
  assert.equal(result.safe, true)
  assert.equal(result.driftDetected, false)
  assert.equal(result.intentDriftProof, 'USER_INTENT_ALIGNMENT_PROVEN')
  assert.ok(result.alignmentRatio >= 0.5)
})

test('auditUserIntentDrift detects excessive drift when code does completely unrelated things', () => {
  const spec = `
# Feature: Order Checkout
Operators need to process payments, compute sales tax, and issue receipts.
`
  const code = `
export function uploadProfileAvatar(userId, imageBlob) {
  return s3.upload(imageBlob);
}
`
  const result = auditUserIntentDrift(spec, code)
  assert.equal(result.safe, false)
  assert.equal(result.driftDetected, true)
  assert.equal(result.intentDriftProof, 'EXCESSIVE_INTENT_DRIFT_OR_SCOPE_CREEP_DETECTED')
})
