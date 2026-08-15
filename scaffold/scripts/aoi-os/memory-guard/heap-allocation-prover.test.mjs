import test from 'node:test'
import assert from 'node:assert/strict'
import { proveHeapAllocations } from './heap-allocation-prover.mjs'

test('proveHeapAllocations approves bounded buffer and array allocations', () => {
  const code = `
export function createBuffer() {
  return Buffer.alloc(1024 * 1024); // 1 MB is safe
}
`
  const result = proveHeapAllocations(code)
  assert.equal(result.safe, true)
  assert.equal(result.heapProof, 'HEAP_ALLOCATIONS_BOUNDED_AND_SAFE')
  assert.equal(result.violationsCount, 0)
})

test('proveHeapAllocations detects excessive buffer and array allocations', () => {
  const code = `
export function makeHugeBuffer() {
  const buf = Buffer.alloc(100000000); // 100 MB
  const arr = new Array(5000000);
}
`
  const result = proveHeapAllocations(code)
  assert.equal(result.safe, false)
  assert.equal(result.heapProof, 'EXCESSIVE_HEAP_ALLOCATION_DETECTED')
  assert.equal(result.violationsCount, 2)
})
