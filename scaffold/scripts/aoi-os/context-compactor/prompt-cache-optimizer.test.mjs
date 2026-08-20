import test from 'node:test'
import assert from 'node:assert/strict'
import { optimizePromptCachePrefix } from './prompt-cache-optimizer.mjs'

test('optimizePromptCachePrefix builds deterministic prefix block and computes signature', () => {
  const result1 = optimizePromptCachePrefix({
    systemConstitution: 'Never use eval. Always use strict types.',
    sharedContracts: ['interface Task { id: string }', 'interface User { name: string }'],
    taskContext: 'Implement task T-1',
  })

  assert.equal(result1.cacheOptimizationProof, 'PROMPT_PREFIX_CACHE_BOUNDARY_ALIGNED')
  assert.equal(result1.prefixHash.length, 64)
  assert.ok(result1.fullPrompt.includes('<!-- SYSTEM_CONSTITUTION_START -->'))
  assert.ok(result1.fullPrompt.includes('<!-- SHARED_CONTRACTS_START -->'))
  assert.ok(result1.fullPrompt.includes('<!-- DYNAMIC_TASK_CONTEXT_START -->'))

  // Different dynamic context must produce identical prefix hash
  const result2 = optimizePromptCachePrefix({
    systemConstitution: 'Never use eval. Always use strict types.',
    sharedContracts: ['interface User { name: string }', 'interface Task { id: string }'], // unsorted in input
    taskContext: 'Implement completely different task T-99',
  })

  assert.equal(result1.prefixHash, result2.prefixHash)
})
