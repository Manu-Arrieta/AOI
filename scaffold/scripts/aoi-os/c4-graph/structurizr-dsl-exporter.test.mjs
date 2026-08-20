import test from 'node:test'
import assert from 'node:assert/strict'
import { exportToStructurizrDsl } from './structurizr-dsl-exporter.mjs'

test('exportToStructurizrDsl generates compliant Structurizr DSL specification', () => {
  const containers = [
    { id: 'dashboard', name: 'Agentic Ops Dashboard', description: 'C2 Command Deck', technology: 'Nuxt 4 / Vue 3' },
    { id: 'kernel', name: 'AOI-OS Orchestrator', description: 'Deterministic Runtime Kernel', technology: 'Node.js ESM' },
    { id: 'memory', name: 'ICM Persistent Memory', description: 'Infinite Context Memory Store', technology: 'Rust / CLI' },
  ]

  const relations = [
    { source: 'dashboard', target: 'kernel', description: 'Sends wave dispatch & control events', technology: 'HTTP / SSE' },
    { source: 'kernel', target: 'memory', description: 'Reads/writes structured knowledge items', technology: 'CLI Subprocess' },
  ]

  const dsl = exportToStructurizrDsl({
    workspaceName: 'AOI Sovereign Matrix',
    containers,
    relations,
  })

  assert.ok(dsl.includes('workspace "AOI Sovereign Matrix"'))
  assert.ok(dsl.includes('dashboard = container "Agentic Ops Dashboard" "C2 Command Deck" "Nuxt 4 / Vue 3"'))
  assert.ok(dsl.includes('kernel = container "AOI-OS Orchestrator" "Deterministic Runtime Kernel" "Node.js ESM"'))
  assert.ok(dsl.includes('dashboard -> kernel "Sends wave dispatch & control events" "HTTP / SSE"'))
  assert.ok(dsl.includes('kernel -> memory "Reads/writes structured knowledge items" "CLI Subprocess"'))
  assert.ok(dsl.includes('systemContext aoiSystem'))
  assert.ok(dsl.includes('theme default'))
})
