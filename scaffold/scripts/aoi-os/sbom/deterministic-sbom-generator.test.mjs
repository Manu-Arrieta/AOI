import test from 'node:test'
import assert from 'node:assert/strict'
import { generateDeterministicSbom } from './deterministic-sbom-generator.mjs'

test('generateDeterministicSbom generates valid CycloneDX SBOM with component hashes', () => {
  const components = [
    { name: 'server/api/tasks.ts', content: 'export const handler = () => {}' },
    { name: '@tanstack/vue-table', version: '^8.21.2', type: 'library' },
  ]

  const sbom = generateDeterministicSbom({
    projectName: 'AOI-OS',
    version: '18.0.0',
    components,
  })

  assert.equal(sbom.bomFormat, 'CycloneDX')
  assert.equal(sbom.totalComponents, 2)
  assert.equal(sbom.sbomProof, 'DETERMINISTIC_SBOM_GENERATED')
  assert.equal(sbom.components[0].hashes[0].value.length, 64)
})
