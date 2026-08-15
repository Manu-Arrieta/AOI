import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileKnowledgeMesh } from './knowledge-mesh-reconciler.mjs'

test('reconcileKnowledgeMesh proves synchronization when memories match active rules', () => {
  const memories = [
    { id: 'mem-1', topic: 'decisions', content: 'Use Pinia for state management in Vue' },
  ]
  const activeRules = ['Use Pinia for frontend state']

  const result = reconcileKnowledgeMesh({ memories, activeRules })
  assert.equal(result.inSync, true)
  assert.equal(result.meshStatus, 'KNOWLEDGE_MESH_SYNCHRONIZED')
  assert.equal(result.totalDrifts, 0)
})

test('reconcileKnowledgeMesh detects obsolete decisions and generates auto-update plans', () => {
  const memories = [
    { id: 'mem-2', topic: 'decisions', content: 'Use Vuex for central state store' },
  ]
  const activeRules = ['Use Pinia and no Vuex']

  const result = reconcileKnowledgeMesh({ memories, activeRules })
  assert.equal(result.inSync, false)
  assert.equal(result.meshStatus, 'KNOWLEDGE_DRIFT_DETECTED')
  assert.equal(result.totalDrifts, 1)
  assert.ok(result.reconciliationPlan.some((p) => p.suggestedContent.includes('Pinia')))
})
