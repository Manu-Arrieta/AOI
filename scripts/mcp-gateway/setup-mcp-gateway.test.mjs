import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  validateGatewayConfig,
  generateCompactSignature,
  auditTier1Names,
  TIER1_SIGNATURES,
} from './setup-mcp-gateway.mjs'
import { ICM_MCP_TOOLS } from '../multi-harness/reference-integrity.mjs'

test('validateGatewayConfig validates valid config', () => {
  const config = {
    compressionMode: 'hybrid',
    tier1CompactTools: ['icm_memory_recall'],
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
  // Los strings son los esquemas reales. La versión anterior de este test
  // fijaba los mismos strings que el código —y por eso la compuerta estuvo
  // verde mientras declaraba `icm_recall`, que no existe.
  assert.match(generateCompactSignature('icm_memory_recall'), /^icm_memory_recall\(query: string, topic\?: string, limit\?: number/)
  assert.match(generateCompactSignature('icm_memory_store'), /^icm_memory_store\(topic: string, content: string/)
  assert.match(generateCompactSignature('search_graph'), /^search_graph\(project: string, query\?: string/)
  assert.match(generateCompactSignature('trace_path'), /^trace_path\(function_name: string, project: string/)
})

test('every declared signature names its own tool, and the enum keeps all four levels', () => {
  // La firma de `icm_memory_store` declaraba `"low"|"high"|"critical"`: tres
  // niveles. El enum del servidor tiene cuatro, y `medium` es el DEFAULT —omitirlo
  // borra el único nivel que un agente usaría por omisión.
  assert.match(TIER1_SIGNATURES.icm_memory_store, /"critical"\|"high"\|"medium"\|"low"/)

  // Y una firma que no arranca con su propio nombre es un mapeo roto: la línea
  // se imprime para que alguien la lea y la copie.
  for (const [name, signature] of Object.entries(TIER1_SIGNATURES)) {
    assert.ok(
      signature.startsWith(`${name}(`),
      `la firma de ${name} no nombra su propia herramienta: ${signature}`
    )
  }
})

test('the shipped config declares only tools the ICM server publishes', () => {
  const config = JSON.parse(fs.readFileSync(path.resolve('scripts/mcp-gateway/mcp-gateway.config.json'), 'utf8'))
  assert.deepEqual(auditTier1Names(config, ICM_MCP_TOOLS), [])

  // Las herramientas de codebase-memory no tienen roster en el repositorio y
  // quedan fuera de la guarda por prefijo. Se declaran acá para que la
  // excepción sea una decisión visible y no un agujero silencioso.
  const sinRoster = config.tier1CompactTools.filter((t) => !t.startsWith('icm_'))
  assert.deepEqual(sinRoster, ['search_graph', 'trace_path'], 'cambió la lista sin roster: revisá el alcance de la guarda')
})

test('auditTier1Names catches a phantom tool, and every name it accepts is real', () => {
  // Control negativo: los dos nombres fantasma que el config declaraba. El
  // primero tenía firma propia; el segundo también. Ninguno existía.
  assert.deepEqual(
    auditTier1Names({ tier1CompactTools: ['icm_recall'] }, ICM_MCP_TOOLS),
    ['icm_recall']
  )
  assert.deepEqual(
    auditTier1Names({ tier1CompactTools: ['icm_memoir'] }, ICM_MCP_TOOLS),
    ['icm_memoir']
  )

  // Y la otra dirección: un nombre real no se reporta. Sin este caso, una
  // guarda que devolviera siempre la lista completa pasaría el control de arriba.
  for (const name of ['icm_memory_recall', 'icm_memory_store', 'icm_memoir_search', 'icm_wake_up']) {
    assert.deepEqual(auditTier1Names({ tier1CompactTools: [name] }, ICM_MCP_TOOLS), [])
  }

  // Un config sin la clave no revienta: la misma función la consume el CLI
  // sobre un JSON que puede venir incompleto.
  assert.deepEqual(auditTier1Names({}, ICM_MCP_TOOLS), [])
})
