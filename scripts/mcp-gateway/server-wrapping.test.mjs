/**
 * scripts/mcp-gateway/server-wrapping.test.mjs
 *
 * Invariant 1 says the savings come from routing every MCP server through the
 * compressor. `auditServerWrapping` is the only thing that checks it, and it
 * shipped without a test — the same shape of hole the audit keeps finding, so
 * worth closing on the check that was just written to close one.
 *
 * Measured on the real toolset, wrapping is worth −83%: icm 3.538 → 638 and
 * codebase-memory-mcp 2.888 → 460 tokens of `tools/list`. Those are paid in the
 * system prompt of every request carrying the MCP surface, so a server that
 * quietly reverts to a direct connection costs all session long.
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { auditServerWrapping, generateCompactSignature, validateGatewayConfig } from './setup-mcp-gateway.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('every MCP server this workspace registers goes through the compressor', () => {
  it('the shipped mcp.json wraps all of them', () => {
    const mcp = JSON.parse(fs.readFileSync(path.join(REPO, '.vscode/mcp.json'), 'utf8'))
    const { wrapped, direct } = auditServerWrapping(mcp)

    assert.deepEqual(direct, [], 'un servidor MCP quedó conectado directo al backend')
    assert.ok(wrapped.length > 0, 'no hay servidores registrados que verificar')
  })

  it('the scaffold ships the same wiring, so a fresh install starts wrapped', () => {
    // An install that begins unwrapped never gets noticed: nothing fails, the
    // schemas are just paid in full forever.
    const mcp = JSON.parse(fs.readFileSync(path.join(REPO, 'scaffold/.vscode/mcp.json'), 'utf8'))
    assert.deepEqual(auditServerWrapping(mcp).direct, [])
  })

  it('the scaffold carries no absolute path from the machine that built it', () => {
    // A hardcoded /Users/<name>/ in the scaffold ships to every workspace and
    // resolves nowhere. Caught once by reading; pinned here so it cannot come
    // back through a regenerated config.
    const raw = fs.readFileSync(path.join(REPO, 'scaffold/.vscode/mcp.json'), 'utf8')
    assert.doesNotMatch(raw, /\/(Users|home)\/[a-z]/i, 'el scaffold lleva una ruta absoluta de una máquina concreta')
  })
})

describe('the audit detects a server that bypasses the proxy', () => {
  it('flags a direct stdio connection', () => {
    // Negative control. Before this check existed, `setup-mcp-gateway` printed
    // a green line for a proxy that was not installed, not a dependency and
    // registered nowhere.
    const { wrapped, direct } = auditServerWrapping({
      servers: {
        proxied: { command: 'mcp-compressor', args: ['-c', 'high', '--', 'icm', 'serve'] },
        raw: { command: 'icm', args: ['serve'] },
      },
    })

    assert.deepEqual(direct, ['raw'])
    assert.deepEqual(wrapped, ['proxied'])
  })

  it('does not mistake a server merely named after the proxy for a wrapped one', () => {
    // The check reads `command`, not the whole entry: a backend that happens
    // to mention the compressor in its args is still connected directly.
    const { direct } = auditServerWrapping({
      servers: { sneaky: { command: 'icm', args: ['serve', '--note', 'mcp-compressor'] } },
    })

    assert.deepEqual(direct, ['sneaky'])
  })

  it('reports nothing rather than crashing on an empty or absent config', () => {
    assert.deepEqual(auditServerWrapping({}), { wrapped: [], direct: [] })
    assert.deepEqual(auditServerWrapping(null), { wrapped: [], direct: [] })
  })
})

describe('the gateway config itself', () => {
  it('rejects a config missing the pieces the proxy needs', () => {
    assert.equal(validateGatewayConfig({}).valid, false)
    assert.equal(validateGatewayConfig(null).valid, false)
    assert.equal(validateGatewayConfig({ compressionMode: 'hybrid', servers: {}, tier1CompactTools: [] }).valid, false)
  })

  it('accepts the shipped config', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/mcp-gateway/mcp-gateway.config.json'), 'utf8'))
    assert.deepEqual(validateGatewayConfig(cfg).errors, [])
  })

  it('gives an unknown tool a generic signature instead of inventing one', () => {
    assert.match(generateCompactSignature('icm_recall'), /icm_recall\(query/)
    assert.equal(generateCompactSignature('tool_desconocida'), 'tool_desconocida(params: object): any')
  })
})

describe('ningún flag puede saltear la auditoría del Invariante 1', () => {
  // La auditoría vivía dentro del `else`, así que `--signatures` imprimía las
  // firmas y salía 0 sin mirar un solo servidor. El Paso 0.2 del protocolo de
  // verificación invoca exactamente esa rama: el paso que debía certificar el
  // Invariante 1 era un verde vacío. Se prueba corriendo el CLI de verdad
  // contra un workspace con un servidor directo.
  const CLI = path.join(REPO, 'scripts/mcp-gateway/setup-mcp-gateway.mjs')

  /** Workspace mínimo: la config que el CLI busca, más un mcp.json elegido. */
  function workspaceWith(servers) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-gateway-'))
    fs.mkdirSync(path.join(dir, 'scripts/mcp-gateway'), { recursive: true })
    fs.mkdirSync(path.join(dir, '.vscode'), { recursive: true })
    fs.copyFileSync(
      path.join(REPO, 'scripts/mcp-gateway/mcp-gateway.config.json'),
      path.join(dir, 'scripts/mcp-gateway/mcp-gateway.config.json'),
    )
    fs.writeFileSync(path.join(dir, '.vscode/mcp.json'), JSON.stringify({ servers }))
    return dir
  }

  const DIRECTO = { raw: { command: 'icm', args: ['serve'] } }
  const ENVUELTO = { proxied: { command: 'mcp-compressor', args: ['-c', 'high', '--', 'icm', 'serve'] } }

  for (const flags of [[], ['--signatures'], ['--filter-coeffects', 'icm_recall']]) {
    const etiqueta = flags.length ? flags.join(' ') : '(sin flags)'

    it(`falla con un servidor directo bajo ${etiqueta}`, () => {
      const r = spawnSync(process.execPath, [CLI, ...flags], { cwd: workspaceWith(DIRECTO), encoding: 'utf8' })
      assert.equal(r.status, 1, `${etiqueta} certificó un servidor conectado directo`)
      assert.match(r.stderr, /Invariante 1/)
    })

    it(`pasa con todo envuelto bajo ${etiqueta}`, () => {
      const r = spawnSync(process.execPath, [CLI, ...flags], { cwd: workspaceWith(ENVUELTO), encoding: 'utf8' })
      assert.equal(r.status, 0, r.stderr)
    })
  }
})
