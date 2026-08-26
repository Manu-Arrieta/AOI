import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateGatewayConfig,
  generateCompactSignature,
} from './setup-mcp-gateway.mjs'

test('validateGatewayConfig validates valid config', () => {
  const config = {
    compressionMode: 'hybrid',
    tier1CompactTools: ['icm_recall'],
    servers: { icm: { command: 'icm', args: ['mcp'] } },
  }
  const result = validateGatewayConfig(config)
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
})

test('validateGatewayConfig catches invalid configs', () => {
  const result = validateGatewayConfig({})
  assert.equal(result.valid, false)
  assert.ok(result.errors.length > 0)
})

test('mcp-gateway.config.json file passes validation', () => {
  const configPath = path.resolve('scripts/mcp-gateway/mcp-gateway.config.json')
  const content = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const result = validateGatewayConfig(content)
  assert.equal(result.valid, true)
  assert.equal(result.errors.length, 0)
})

test('generateCompactSignature outputs concise TypeScript signatures', () => {
  assert.equal(
    generateCompactSignature('icm_recall'),
    'icm_recall(query: string, topic?: string, limit?: number): MemoryItem[]'
  )
  assert.equal(
    generateCompactSignature('search_graph'),
    'search_graph(symbol: string, depth?: number): GraphNode[]'
  )
})
