import test from 'node:test'
import assert from 'node:assert/strict'
import { createLivePatchKernel } from './live-patch-kernel.mjs'

test('createLivePatchKernel registers, invokes, and hot-patches symbols in memory without losing state', () => {
  const kernel = createLivePatchKernel()

  // 1. Register symbol
  kernel.registerSymbol('calc:tax', (amount) => amount * 0.10)
  assert.equal(kernel.invokeSymbol('calc:tax', 100), 10)

  // 2. Hot-patch symbol on the fly
  const patch = kernel.applyHotPatch('calc:tax', (amount) => amount * 0.15, 'update-tax-rate')
  assert.equal(patch.success, true)
  assert.equal(patch.newVersion, 2)

  // 3. Invoke patched symbol
  assert.equal(kernel.invokeSymbol('calc:tax', 100), 15)
  assert.equal(kernel.getPatchHistory().length, 1)
})
