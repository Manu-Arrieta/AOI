import test from 'node:test'
import assert from 'node:assert/strict'
import { createProvenanceChain } from './epistemic-provenance-chain.mjs'

test('createProvenanceChain appends verifiable cryptographic blocks and verifies chain integrity', () => {
  const chain = createProvenanceChain()

  const b1 = chain.appendProvenanceBlock({
    taskId: 'T-1',
    requirement: 'Build Auth API',
    modifiedFiles: ['server/api/auth.ts'],
    assertions: ['Returns 200 OK'],
    memoryId: '01M035F0SR',
  })

  assert.equal(b1.index, 0)
  assert.equal(b1.hash.length, 64)
  assert.equal(b1.previousHash, '0000000000000000000000000000000000000000000000000000000000000000')

  const b2 = chain.appendProvenanceBlock({
    taskId: 'T-2',
    requirement: 'Build C# Client',
    modifiedFiles: ['Client/AuthClient.cs'],
    assertions: ['Authenticates token'],
    memoryId: '01M037MG7E',
  })

  assert.equal(b2.index, 1)
  assert.equal(b2.previousHash, b1.hash)

  const verify = chain.verifyChainIntegrity()
  assert.equal(verify.valid, true)
  assert.equal(verify.status, 'CHAIN_INTEGRITY_VERIFIED_100PCT')
  assert.equal(verify.totalBlocks, 2)
})
