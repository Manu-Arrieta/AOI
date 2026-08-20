import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSandboxWasmMemoryQuotaSafety } from './sandbox-wasm-memory-quota-prover.mjs'

test('proveSandboxWasmMemoryQuotaSafety approves WebAssembly.Memory with initial and maximum', () => {
  const code = `
const memory = new WebAssembly.Memory({
  initial: 10,
  maximum: 256,
});
`
  const result = proveSandboxWasmMemoryQuotaSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.hasMaximumBound, true)
  assert.equal(result.wasmMemoryQuotaProof, 'WASM_MEMORY_MAXIMUM_PAGE_BOUND_VERIFIED')
})

test('proveSandboxWasmMemoryQuotaSafety detects WebAssembly.Memory missing maximum limit', () => {
  const code = `
const memory = new WebAssembly.Memory({
  initial: 10,
});
`
  const result = proveSandboxWasmMemoryQuotaSafety(code)
  assert.equal(result.safe, false)
  assert.equal(result.wasmMemoryQuotaProof, 'UNBOUNDED_WASM_LINEAR_MEMORY_GROWTH_RISK_DETECTED')
  assert.ok(result.violations.includes('WASM_MEMORY_MISSING_EXPLICIT_MAXIMUM_PAGE_BOUND'))
})

test('proveSandboxWasmMemoryQuotaSafety returns safe when no WASM memory is instantiated', () => {
  const code = `
const x = 42;
`
  const result = proveSandboxWasmMemoryQuotaSafety(code)
  assert.equal(result.safe, true)
  assert.equal(result.wasmMemoryQuotaProof, 'NO_WASM_MEMORY_INSTANTIATION_DETECTED')
})
