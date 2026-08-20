import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSequenceDiagram } from './sequence-diagram-generator.mjs'

test('generateSequenceDiagram generates structured Mermaid sequence diagram with waves', () => {
  const waves = [
    [
      { id: 'T-1', title: 'Auth API', role: 'backend' },
      { id: 'T-2', title: 'Auth UI', role: 'frontend' },
    ],
    [
      { id: 'T-3', title: 'CI Pipeline', role: 'devops' },
    ],
  ]

  const diagram = generateSequenceDiagram({
    featureTitle: 'Authentication Flow',
    waves,
  })

  assert.ok(diagram.includes('sequenceDiagram'))
  assert.ok(diagram.includes('actor Owner as 👤 Owner / Architect'))
  assert.ok(diagram.includes('Wave 1 (2 tasks in parallel)'))
  assert.ok(diagram.includes('Wave 2 (1 tasks in parallel)'))
  assert.ok(diagram.includes('Engine->>+Backend: Dispatch T-1 (Auth API)'))
  assert.ok(diagram.includes('Engine->>+Frontend: Dispatch T-2 (Auth UI)'))
  assert.ok(diagram.includes('Engine->>+DevOps: Dispatch T-3 (CI Pipeline)'))
  assert.ok(diagram.includes('/sdd-archive (Synchronize Persistent ICM Memory)'))
})
