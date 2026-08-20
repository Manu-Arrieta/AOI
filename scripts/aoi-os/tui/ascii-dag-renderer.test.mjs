import test from 'node:test'
import assert from 'node:assert/strict'
import { renderAsciiDag } from './ascii-dag-renderer.mjs'

test('renderAsciiDag handles empty graph gracefully', () => {
  const rendered = renderAsciiDag([])
  assert.ok(rendered.includes('Empty Task Graph'))
})

test('renderAsciiDag formats multi-wave DAG with box borders and dependency arrows', () => {
  const waves = [
    [
      { id: 'T-1', title: 'Database Schema', role: 'backend' },
      { id: 'T-2', title: 'UI Layout', role: 'frontend' },
    ],
    [
      { id: 'T-3', title: 'Integration Test', role: 'devops' },
    ],
  ]

  const rendered = renderAsciiDag(waves)
  assert.ok(rendered.includes('Wave 1 [2 tasks]'))
  assert.ok(rendered.includes('Wave 2 [1 task]'))
  assert.ok(rendered.includes('[T-1] Database Schema (@backend)'))
  assert.ok(rendered.includes('[T-2] UI Layout (@frontend)'))
  assert.ok(rendered.includes('[T-3] Integration Test (@devops)'))
  assert.ok(rendered.includes('▼'))
})
