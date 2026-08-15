import test from 'node:test'
import assert from 'node:assert/strict'
import { generateC4ArchitectureDiagram } from './c4-architecture-generator.mjs'

test('generateC4ArchitectureDiagram creates valid Mermaid C4 graph from DAG nodes', () => {
  const nodes = [
    { id: 'T-1', title: 'Auth API', role: 'backend', targetFiles: ['server/auth.ts'], status: 'completed' },
    { id: 'T-2', title: 'Login View', role: 'frontend', dependsOn: ['T-1'], targetFiles: ['app/Login.vue'], status: 'in_progress' },
  ]

  const c4 = generateC4ArchitectureDiagram(nodes, { systemName: 'Security Subsystem' })
  assert.equal(c4.containerCount, 2)
  assert.equal(c4.relationsCount, 1)
  assert.ok(c4.mermaidDiagram.includes('subgraph System["Security Subsystem"]'))
  assert.ok(c4.mermaidDiagram.includes('T-1 -->|depends on| T-2'))
  assert.ok(c4.mermaidDiagram.includes('✅ T-1: Auth API'))
  assert.ok(c4.mermaidDiagram.includes('⚡ T-2: Login View'))
})
