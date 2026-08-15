import { describe, expect, it } from 'vitest'
import { generateC4ArchitectureDiagram } from '../../server/utils/c4-generator'

describe('AOI-OS C4 Dynamic Graph API', () => {
  it('generates Mermaid C4 container diagram successfully', () => {
    const nodes = [
      { id: 'T-1', title: 'Auth API', role: 'backend', targetFiles: ['server/auth.ts'], status: 'completed' },
      { id: 'T-2', title: 'Dashboard', role: 'frontend', dependsOn: ['T-1'], status: 'in_progress' },
    ]

    const result = generateC4ArchitectureDiagram(nodes, { systemName: 'Test System' })
    expect(result.containerCount).toBe(2)
    expect(result.relationsCount).toBe(1)
    expect(result.mermaidDiagram).toContain('subgraph System["Test System"]')
  })
})
