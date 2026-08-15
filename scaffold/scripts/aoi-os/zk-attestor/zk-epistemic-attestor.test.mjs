import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMerkleTree, generateEpistemicAttestation } from './zk-epistemic-attestor.mjs'

test('buildMerkleTree builds deterministic 64-char root from leaf hashes', () => {
  const leaves = ['assert_1_ok', 'assert_2_ok', 'assert_3_ok']
  const tree = buildMerkleTree(leaves)
  assert.equal(tree.root.length, 64)
  assert.equal(tree.leaves.length, 3)
  assert.ok(tree.depth >= 2)
})

test('generateEpistemicAttestation generates cryptographic compliance proof when all assertions pass', () => {
  const assertions = [
    { assertion: 'HTTP 200 returned', passed: true },
    { assertion: 'AST contract unbroken', passed: true },
    { assertion: '0 memory leaks detected', passed: true },
  ]

  const attestation = generateEpistemicAttestation('TASK-100', assertions)
  assert.equal(attestation.allPassed, true)
  assert.equal(attestation.attestationProof, 'PROVEN_CRYPTOGRAPHIC_COMPLIANCE')
  assert.equal(attestation.merkleRoot.length, 64)
  assert.equal(attestation.totalAssertions, 3)
})
