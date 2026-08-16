import test from 'node:test'
import assert from 'node:assert/strict'
import { auditDeadRoutes } from './dead-route-pruner.mjs'

test('auditDeadRoutes approves fully referenced routes', () => {
  const routes = ['/api/tasks', '/api/users']
  const clientCode = `
const tasks = await fetch('/api/tasks');
const users = await fetch('/api/users');
`
  const result = auditDeadRoutes(routes, clientCode)
  assert.equal(result.fullyCovered, true)
  assert.equal(result.prunerProof, 'ALL_API_ROUTES_ACTIVELY_REFERENCED')
  assert.equal(result.orphanCount, 0)
})

test('auditDeadRoutes detects unreferenced orphan routes', () => {
  const routes = ['/api/tasks', '/api/legacy-reports']
  const clientCode = `
const tasks = await fetch('/api/tasks');
`
  const result = auditDeadRoutes(routes, clientCode)
  assert.equal(result.fullyCovered, false)
  assert.equal(result.prunerProof, 'ORPHAN_DEAD_ROUTES_DETECTED')
  assert.equal(result.orphanCount, 1)
  assert.equal(result.orphanRoutes[0].route, '/api/legacy-reports')
})
