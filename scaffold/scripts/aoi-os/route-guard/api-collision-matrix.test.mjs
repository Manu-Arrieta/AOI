import test from 'node:test'
import assert from 'node:assert/strict'
import { auditRouteCollisions } from './api-collision-matrix.mjs'

test('auditRouteCollisions passes for distinct and well-formed API routes', () => {
  const routes = [
    { method: 'GET', path: '/api/tasks' },
    { method: 'POST', path: '/api/tasks' },
    { method: 'GET', path: '/api/tasks/:id' },
    { method: 'DELETE', path: '/api/tasks/:id' },
  ]

  const result = auditRouteCollisions(routes)
  assert.equal(result.hasCollisions, false)
  assert.equal(result.matrixStatus, 'API_ROUTE_TOPOLOGY_OPTIMAL')
  assert.equal(result.collisionsCount, 0)
})

test('auditRouteCollisions detects parameterized route collisions and shadowing', () => {
  const routes = [
    { method: 'GET', path: '/api/tasks/:id' },
    { method: 'GET', path: '/api/tasks/[taskId]' }, // Parameter collision on GET
  ]

  const result = auditRouteCollisions(routes)
  assert.equal(result.hasCollisions, true)
  assert.equal(result.matrixStatus, 'API_ROUTE_COLLISIONS_DETECTED')
  assert.equal(result.collisionsCount, 1)
  assert.equal(result.collisions[0].type, 'ROUTE_SHADOWING_OR_METHOD_COLLISION')
})
