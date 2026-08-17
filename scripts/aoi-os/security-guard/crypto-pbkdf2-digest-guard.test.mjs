import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCryptoPbkdf2DigestSafety } from './crypto-pbkdf2-digest-guard.mjs'

test('auditCryptoPbkdf2DigestSafety approves PBKDF2 with sha512 digest', () => {
  const code = `
const key = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
`
  const result = auditCryptoPbkdf2DigestSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.digestProof, 'ROBUST_PBKDF2_DIGEST_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('auditCryptoPbkdf2DigestSafety detects insecure legacy sha1 digest in PBKDF2', () => {
  const code = `
const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha1');
`
  const result = auditCryptoPbkdf2DigestSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.digestProof, 'WEAK_PBKDF2_DIGEST_VULNERABILITY_RISK')
  assert.equal(result.violationsCount, 1)
})
