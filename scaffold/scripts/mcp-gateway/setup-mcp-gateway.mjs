#!/usr/bin/env node
/**
 * scripts/mcp-gateway/setup-mcp-gateway.mjs
 *
 * Configures and verifies the MCP Compression Gateway proxy using
 * @atlassian-labs/mcp-compressor. It enforces the Zero-Disabled-Tools
 * routing invariant; it does not measure a universal token-saving rate.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ICM_MCP_TOOLS } from '../multi-harness/reference-integrity.mjs'

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
 * Las firmas compactas de las herramientas Tier 1, como dato.
 *
 * Cada entrada nombra la HERRAMIENTA REAL y reproduce sus parámetros según el
 * esquema que publica su servidor. Las que se abrevian llevan `…`: una firma
 * compacta puede recortar, lo que no puede es mentir por omisión.
 *
 * El defecto que esta tabla reemplaza, medido el 2026-09-19: las cinco firmas
 * anteriores nombraban herramientas que no existen (`icm_recall`, `icm_store`,
 * `icm_memoir`) o declaraban parámetros inventados. Tres consecuencias
 * concretas: el orden de parámetros de `icm_memory_store` estaba INVERTIDO
 * (`content` antes de `topic`), la importancia declaraba tres niveles cuando el
 * enum tiene cuatro —faltaba `medium`—, y `icm_memoir` no existe: son diez
 * herramientas `icm_memoir_*`.
 *
 * Nada lo detectaba. El único consumidor era el test que fijaba los mismos
 * strings, así que la tabla podía divergir del servidor para siempre con la
 * compuerta en verde — el mismo patrón que `reference-integrity` existe para
 * cazar con `icm_memoir_add_observation`. `auditTier1Names` es la guarda que
 * faltaba en la otra mitad: los nombres.
 *
 * La omisión de `medium` merece un renglón aparte: es exactamente la clase de
 * defecto que `icm-protocol-completeness.test.mjs` documenta haber sufrido
 * (*"a compression pass silently dropped the `low` importance level, which
 * nothing else would have caught"*). Otra compresión tiró `medium`, y nada lo
 * cazó, porque la guarda que existe cubre un solo archivo.
 */
export const TIER1_SIGNATURES = {
  icm_memory_recall:
    'icm_memory_recall(query: string, topic?: string, limit?: number, keyword?: string, project?: string): MemoryItem[]',
  icm_memory_store:
    'icm_memory_store(topic: string, content: string, importance: "critical"|"high"|"medium"|"low", keywords?: string[], raw_excerpt?: string): string',
  icm_memoir_search:
    'icm_memoir_search(memoir: string, query: string, label?: string, limit?: number): Concept[]',
  search_graph:
    'search_graph(project: string, query?: string, label?: string, name_pattern?: string, …, limit?: number, offset?: number): GraphNode[]',
  trace_path:
    'trace_path(function_name: string, project: string, direction?: "inbound"|"outbound"|"both", depth?: number, mode?: "calls"|"data_flow"|"cross_service", …, include_tests?: boolean): PathResult',
}

/**
 * Firma compacta de una herramienta Tier 1.
 *
 * El fallback cubre una herramienta que la tabla no conoce; `auditTier1Names`
 * tiene que haberla reportado antes de llegar acá. Un nombre que cae al
 * fallback no es una herramienta declarada: es una que nadie declaró.
 *
 * @param {string} toolName
 * @returns {string}
 */
export function generateCompactSignature(toolName) {
  return TIER1_SIGNATURES[toolName] ?? `${toolName}(params: object): any`
}

/**
 * Herramientas Tier 1 que el roster real del servidor no conoce.
 *
 * Es la guarda que faltaba, y cubre la mitad que ninguna otra podía: la tabla
 * de firmas sólo prueba que un nombre TIENE firma, no que la herramienta EXISTA.
 * `icm_recall` tenía las dos: firma propia y ninguna existencia.
 *
 * El roster es el del servidor ICM porque es el único que AOI puede leer sin
 * hablar con el proceso. Las herramientas de `codebase-memory` no tienen roster
 * en el repositorio —su lista vive en la prosa de los agentes— así que quedan
 * fuera de esta guarda por prefijo, y eso está declarado en el test en vez de
 * asumido.
 *
 * @param {object} config gateway config
 * @param {Set<string>} roster nombres de herramienta que el servidor publica
 * @returns {string[]} nombres de prefijo `icm_` que no resuelven
 */
export function auditTier1Names(config, roster) {
  const unknown = []
  for (const name of config?.tier1CompactTools ?? []) {
    if (name.startsWith('icm_') && !roster.has(name)) unknown.push(name)
  }
  return unknown
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

    // Un nombre que el servidor no publica no se imprime como si existiera. La
    // validación de forma no puede verlo: `icm_recall` era un string no vacío
    // en un array no vacío, que es todo lo que la forma exige.
    const unknown = auditTier1Names(config, ICM_MCP_TOOLS)
    if (unknown.length > 0) {
      process.stderr.write(`❌ Herramientas Tier 1 que el servidor no publica: ${unknown.join(', ')}\n`)
      process.stderr.write(`   Un nombre fantasma con firma propia pasa cualquier chequeo de forma.\n`)
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
