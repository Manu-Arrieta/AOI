#!/usr/bin/env node
/**
 * scripts/mcp-gateway/setup-mcp-gateway.mjs
 *
 * Configures and verifies the MCP Compression Gateway proxy using
 * @atlassian-labs/mcp-compressor. Ensures Zero-Disabled-Tools invariant
 * while reducing schema overhead by up to 85%.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Checks that every MCP server the workspace registers actually goes through
 * the compressor, rather than straight to the backend.
 *
 * This is the check the module was missing. Everything else here reads a
 * config file and reports on its shape, which said nothing about whether the
 * proxy was in the path — and for a long time it was not: `mcp-compressor` was
 * not a dependency, setup.sh never installed it, and no `mcp.json` named it,
 * while the audit step in the protocol printed a green line anyway.
 *
 * @param {object} mcpJson parsed .vscode/mcp.json
 * @returns {{ wrapped: string[], direct: string[] }}
 */
export function auditServerWrapping(mcpJson) {
  const wrapped = []
  const direct = []
  for (const [name, cfg] of Object.entries(mcpJson?.servers ?? {})) {
    const command = String(cfg?.command ?? '')
    if (/mcp-compressor/.test(command)) wrapped.push(name)
    else direct.push(name)
  }
  return { wrapped, direct }
}

/**
 * Validates gateway configuration structure.
 *
 * @param {object} config
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateGatewayConfig(config) {
  const errors = []
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration must be a non-empty object'] }
  }

  if (!config.compressionMode) {
    errors.push('Missing compressionMode')
  }

  if (!config.servers || typeof config.servers !== 'object' || Object.keys(config.servers).length === 0) {
    errors.push('No MCP servers defined in gateway config')
  }

  if (!Array.isArray(config.tier1CompactTools) || config.tier1CompactTools.length === 0) {
    errors.push('tier1CompactTools must specify at least one high-frequency tool')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Generates compact signature representation for Tier 1 tools.
 *
 * @param {string} toolName
 * @returns {string}
 */
export function generateCompactSignature(toolName) {
  switch (toolName) {
    case 'icm_recall':
      return 'icm_recall(query: string, topic?: string, limit?: number): MemoryItem[]'
    case 'icm_store':
      return 'icm_store(content: string, topic: string, importance: "low"|"high"|"critical"): boolean'
    case 'icm_memoir':
      return 'icm_memoir(query: string): string'
    case 'search_graph':
      return 'search_graph(symbol: string, depth?: number): GraphNode[]'
    case 'trace_path':
      return 'trace_path(fromSymbol: string, toSymbol: string): PathResult'
    default:
      return `${toolName}(params: object): any`
  }
}

/**
 * Audits Invariant 1 against the workspace's real `.vscode/mcp.json`.
 *
 * Config shape is necessary and nowhere near sufficient: what decides whether
 * Invariant 1 holds is which servers the workspace actually registers, and
 * whether each one sits behind the compressor.
 *
 * Exits 1 on any server connected directly — absence of the file is not a
 * failure (there is nothing to wrap), but a direct server is.
 */
export function auditWorkspaceWrapping(cwd = process.cwd()) {
  const mcpPath = path.resolve(cwd, '.vscode/mcp.json')
  if (!fs.existsSync(mcpPath)) {
    process.stdout.write(`ℹ  .vscode/mcp.json ausente — sin servidores que verificar.\n`)
    return
  }
  const { wrapped, direct } = auditServerWrapping(JSON.parse(fs.readFileSync(mcpPath, 'utf8')))
  for (const s of wrapped) process.stdout.write(`   ✅ ${s} → detrás de mcp-compressor\n`)
  for (const s of direct) process.stderr.write(`   ❌ ${s} → conectado DIRECTO, sin comprimir\n`)
  if (direct.length > 0) {
    process.stderr.write(`\nInvariante 1: cada servidor MCP debe registrarse detrás del compresor.\n`)
    process.exit(1)
  }
}

// CLI Execution
export async function main() {
  const args = process.argv.slice(2)
  const configPath = path.resolve('scripts/mcp-gateway/mcp-gateway.config.json')

  if (!fs.existsSync(configPath)) {
    process.stderr.write(`Error: Gateway config not found at ${configPath}\n`)
    process.exit(1)
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const config = JSON.parse(raw)
    const validation = validateGatewayConfig(config)

    if (!validation.valid) {
      process.stderr.write(`❌ Gateway Config Invalid:\n` + validation.errors.map((e) => `  - ${e}`).join('\n') + '\n')
      process.exit(1)
    }

    if (args.includes('--signatures')) {
      process.stdout.write(`=== Tier 1 Compact Signatures ===\n`)
      for (const t of config.tier1CompactTools || []) {
        process.stdout.write(`- ${generateCompactSignature(t)}\n`)
      }
    } else if (args.includes('--filter-coeffects')) {
      const filterIdx = args.indexOf('--filter-coeffects')
      const targetTools = args.slice(filterIdx + 1).filter(a => !a.startsWith('--'))
      process.stdout.write(`=== Dynamic Coeffect Signatures (${targetTools.length}) ===\n`)
      for (const t of targetTools) {
        process.stdout.write(`- ${generateCompactSignature(t)}\n`)
      }
    } else {
      process.stdout.write(`✅ MCP Gateway Config OK (${Object.keys(config.servers).length} servers, ${config.tier1CompactTools.length} compact tools)\n`)
    }

    // El Invariante 1 se audita SIEMPRE, cualquiera sea el flag. Vivía dentro
    // del `else`, así que `--signatures` imprimía firmas y salía 0 sin mirar un
    // solo servidor — y el Paso 0.2 del protocolo de verificación invoca
    // exactamente esa rama. Un flag elige QUÉ se imprime de más, nunca si el
    // invariante se comprueba.
    auditWorkspaceWrapping()
  } catch (err) {
    process.stderr.write(`Error reading gateway config: ${err.message}\n`)
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}

