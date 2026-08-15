import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadCode } from './ast-deadcode-guard.mjs'

test('auditDeadCode detects unused named imports and orphan variables', () => {
  const code = `
import { ref, computed, onMounted } from 'vue'

export function useCounter() {
  const count = ref(0);
  const unusedTemp = 42;
  return { count };
}
`
  const result = auditDeadCode(code, 'useCounter.ts')
  assert.equal(result.clean, false)
  assert.ok(result.unusedImports.includes('computed') || result.unusedImports.includes('onMounted'))
  assert.ok(result.orphanVariables.includes('unusedTemp'))
})

test('auditDeadCode passes fully utilized code', () => {
  const code = `
import { ref } from 'vue'

export function useCount() {
  const value = ref(10);
  return { value };
}
`
  const result = auditDeadCode(code, 'useCount.ts')
  assert.equal(result.clean, true)
  assert.equal(result.unusedImports.length, 0)
  assert.equal(result.orphanVariables.length, 0)
})
