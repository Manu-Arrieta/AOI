import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxSriIntegritySafety } from './sandbox-sri-integrity-prover.mjs'

test('proveSandboxSriIntegritySafety approves dynamic script injection with SRI integrity attribute', () => {
  const code = `
function loadRemotePlugin(url, integrityHash) {
  const script = document.createElement('script');
  script.src = url;
  script.integrity = integrityHash;
  script.crossOrigin = 'anonymous';
  document.head.appendChild(script);
}
`
  const result = proveSandboxSriIntegritySafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.sriProof, 'CRYPTOGRAPHIC_SUBRESOURCE_INTEGRITY_ENFORCED')
  assert.equal(result.violationsCount, 0)
})

test('proveSandboxSriIntegritySafety detects unverified dynamic remote script loading', () => {
  const code = `
function loadRemotePlugin(url) {
  const script = document.createElement('script');
  script.src = url;
  document.head.appendChild(script);
}
`
  const result = proveSandboxSriIntegritySafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.sriProof, 'UNAUTHENTICATED_REMOTE_MODULE_RISK')
  assert.equal(result.violationsCount, 1)
})
