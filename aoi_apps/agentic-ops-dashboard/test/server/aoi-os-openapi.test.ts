import { describe, expect, it } from 'vitest'
import { synthesizeOpenApiSpec } from '../../../../scripts/aoi-os/contract-docgen/openapi-synthesizer.mjs'

describe('OpenAPI 3.1 Synthesizer Endpoint', () => {
  it('generates compliant OpenAPI 3.1 specification object', () => {
    const tasks = [
      { id: 'T-1', title: 'Stream Events', role: 'devops', targetFiles: ['server/api/aoi-os/stream.get.ts'] },
    ]

    const spec = synthesizeOpenApiSpec(tasks, { title: 'AOI-OS API' })
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('AOI-OS API')
    expect(spec.paths['/api/aoi-os/stream']).toBeDefined()
  })
})
