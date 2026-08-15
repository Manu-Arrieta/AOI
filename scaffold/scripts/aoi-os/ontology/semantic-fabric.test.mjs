import test from 'node:test'
import assert from 'node:assert/strict'
import { createSemanticFabric } from './semantic-fabric.mjs'

test('createSemanticFabric tracks domain relations and performs topological distance queries', () => {
  const fabric = createSemanticFabric()

  // 1. Add nodes
  fabric.addNode('domain:billing', 'domain', 'Billing & Invoicing')
  fabric.addNode('task:T-1', 'task', 'Build Invoice Endpoint')
  fabric.addNode('symbol:InvoiceDto', 'symbol', 'InvoiceDto')
  fabric.addNode('topic:decisions-AOI', 'memory_topic', 'Decisions')

  // 2. Connect relations
  fabric.addEdge('task:T-1', 'domain:billing', 'touches_domain')
  fabric.addEdge('task:T-1', 'symbol:InvoiceDto', 'implements_contract')
  fabric.addEdge('task:T-1', 'topic:decisions-AOI', 'records_decision')

  // 3. Query related nodes
  const related = fabric.queryRelatedNodes('task:T-1', 1)
  assert.equal(related.length, 3)

  // 4. Compute domain impact
  const impact = fabric.computeDomainImpact(['task:T-1'])
  assert.equal(impact.length, 1)
  assert.equal(impact[0].domain, 'Billing & Invoicing')
  assert.deepEqual(impact[0].impactedTasks, ['task:T-1'])
})
