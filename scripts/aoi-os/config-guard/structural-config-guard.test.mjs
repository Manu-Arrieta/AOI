import test from 'node:test'
import assert from 'node:assert/strict'
import { validateStructuralConfig } from './structural-config-guard.mjs'

test('validateStructuralConfig approves valid JSON and JSONC configs', () => {
  const jsonContent = '{"name": "aoi-os", "version": "26.0.0"}'
  const jsoncContent = `
  {
    // Compiler options
    "compilerOptions": {
      "target": "ESNext"
    }
  }
  `

  const resJson = validateStructuralConfig(jsonContent, 'json')
  assert.equal(resJson.valid, true)
  assert.equal(resJson.structuralProof, 'CONFIG_SYNTAX_AND_AST_STRUCTURE_PROVEN')

  const resJsonc = validateStructuralConfig(jsoncContent, 'jsonc')
  assert.equal(resJsonc.valid, true)
  assert.equal(resJsonc.structuralProof, 'CONFIG_SYNTAX_AND_AST_STRUCTURE_PROVEN')
})

test('validateStructuralConfig detects malformed configuration files', () => {
  const brokenJson = '{"name": "aoi-os", "version": 26.0.0, }'
  const result = validateStructuralConfig(brokenJson, 'json')
  assert.equal(result.valid, false)
  assert.equal(result.structuralProof, 'MALFORMED_CONFIG_SYNTAX_DETECTED')
  assert.ok(result.error)
})
