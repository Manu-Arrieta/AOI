import test from 'node:test'
import assert from 'node:assert/strict'
import { auditHydrationSafety } from './hydration-mismatch-guard.mjs'

test('auditHydrationSafety approves deterministic Vue component', () => {
  const sfc = `
<script setup lang="ts">
import { ref, onMounted } from 'vue';
const token = ref('');
onMounted(() => {
  token.value = window.localStorage.getItem('token') || '';
});
</script>
<template>
  <div><span>{{ token }}</span></div>
</template>
`
  const result = auditHydrationSafety(sfc)
  assert.equal(result.safe, true)
  assert.equal(result.hydrationProof, 'SSR_HYDRATION_DETERMINISM_PROVEN')
  assert.equal(result.violationsCount, 0)
})

test('auditHydrationSafety detects template non-deterministic expression and root window access', () => {
  const sfc = `
<script setup lang="ts">
const token = window.localStorage.getItem('token');
</script>
<template>
  <div><span>{{ Math.random() }}</span></div>
</template>
`
  const result = auditHydrationSafety(sfc)
  assert.equal(result.safe, false)
  assert.equal(result.hydrationProof, 'POTENTIAL_HYDRATION_MISMATCH_DETECTED')
  assert.equal(result.violationsCount, 2)
})
