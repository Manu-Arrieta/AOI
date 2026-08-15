import test from 'node:test'
import assert from 'node:assert/strict'
import { neutralizeCircularDependencies } from './circular-dependency-neutralizer.mjs'

test('neutralizeCircularDependencies proves acyclic topology for clean graphs', () => {
  const cleanGraph = {
    'controller.ts': ['service.ts'],
    'service.ts': ['repository.ts'],
    'repository.ts': [],
  }

  const result = neutralizeCircularDependencies(cleanGraph)
  assert.equal(result.hasCycles, false)
  assert.equal(result.topologyStatus, 'ACYCLIC_TOPOLOGY_VERIFIED')
  assert.equal(result.totalCycles, 0)
})

test('neutralizeCircularDependencies detects cycles and emits decoupling proposals', () => {
  const cyclicGraph = {
    'user.service.ts': ['order.service.ts'],
    'order.service.ts': ['user.service.ts'],
  }

  const result = neutralizeCircularDependencies(cyclicGraph)
  assert.equal(result.hasCycles, true)
  assert.equal(result.topologyStatus, 'CIRCULAR_DEPENDENCIES_DETECTED')
  assert.ok(result.totalCycles >= 1)
  assert.ok(result.decouplingPlans.some((p) => p.action === 'EXTRACT_SHARED_INTERFACE_INTERMEDIARY'))
})
