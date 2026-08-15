import test from 'node:test'
import assert from 'node:assert/strict'
import { optimizePromptCache } from './prefix-deduplication-engine.mjs'

test('optimizePromptCache segregates static invariant prefix and produces 64-char cache key', () => {
  const systemRules = 'Constitutional Directive: Deterministic 0-waste code execution'
  const contractSchemas = 'interface Task { id: string; status: "pending" | "completed"; }'
  const taskDiff = 'Implement handleTaskCompletion() in task.service.ts'

  const result = optimizePromptCache({ systemRules, contractSchemas, taskDiff })
  assert.equal(result.prefixCacheKey.length, 64)
  assert.equal(result.expectedCacheHitRatePct, 100)
  assert.equal(result.optimizationProof, 'KV_CACHE_OPTIMIZED_PREFIX_SEGREGATED')
  assert.ok(result.staticPrefix.includes('Constitutional Directive'))
  assert.ok(result.dynamicSuffix.includes('Implement handleTaskCompletion'))
})
