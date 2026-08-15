import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRouteFromPath, synthesizeOpenApiSpec } from './openapi-synthesizer.mjs'

test('parseRouteFromPath accurately extracts HTTP method and parameters from file paths', () => {
  const r1 = parseRouteFromPath('server/api/tasks/_taskId_.get.ts')
  assert.equal(r1.method, 'get')
  assert.equal(r1.path, '/api/tasks/{taskId}')

  const r2 = parseRouteFromPath('server/api/aoi-os/control.post.ts')
  assert.equal(r2.method, 'post')
  assert.equal(r2.path, '/api/aoi-os/control')
})

test('synthesizeOpenApiSpec generates valid OpenAPI 3.1 structure from task list', () => {
  const tasks = [
    {
      id: 'T-1',
      title: 'Get Task By ID',
      role: 'backend',
      targetFiles: ['server/api/tasks/_taskId_.get.ts'],
    },
    {
      id: 'T-2',
      title: 'Trigger C2 Action',
      role: 'devops',
      targetFiles: ['server/api/aoi-os/control.post.ts'],
    },
  ]

  const spec = synthesizeOpenApiSpec(tasks, { title: 'Test API' })
  assert.equal(spec.openapi, '3.1.0')
  assert.equal(spec.info.title, 'Test API')
  assert.ok(spec.paths['/api/tasks/{taskId}'])
  assert.ok(spec.paths['/api/tasks/{taskId}'].get)
  assert.equal(spec.paths['/api/tasks/{taskId}'].get.summary, 'Get Task By ID')
  assert.ok(spec.paths['/api/aoi-os/control'].post)
})
