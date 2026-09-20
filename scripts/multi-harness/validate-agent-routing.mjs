#!/usr/bin/env node
/**
 * scripts/multi-harness/validate-agent-routing.mjs
 *
 * Guarantees that every agent is routable.
 *
 * The agent registry in `agent-delegation.instructions.md` is not documentation
 * about the routing — it IS the routing. It maps each agent to the model
 * parameter `runSubagent` must be called with, to its NVIDIA NIM fallback, and
 * to the file that defines it. An agent missing from that table cannot be
 * delegated to; an agent whose skill path is wrong delegates into nothing.
 *
 * The table used to exist twice, character for character, in this file and in
 * `model-selection.instructions.md`. Both are injected together into the
 * context of any `.prompt.md`, so the copy was paid in all six phases of the
 * cycle while adding no capability. Consolidating them is only safe if
 * something proves, mechanically and on every run, that no agent lost its
 * model or its fallback in the process. That is this script.
 *
 * Zero inference tokens: it reads the table and the agents directory.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REGISTRY = '.github/instructions/agent-delegation.instructions.md'
export const AGENTS_DIR = '.github/agents'
/** Files that describe the protocol rather than an agent the registry must list. */
const NOT_AN_AGENT = new Set([])

/**
 * Parses the registry rows.
 * @returns {Map<string, {model: string, fallback: string, skill: string}>}
 */
export function parseRegistry(text) {
  const rows = new Map()
  for (const line of text.split('\n')) {
    if (!line.startsWith('| `')) continue
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    const agent = cells[0].replace(/`/g, '').replace(/^@/, '')
    // The definition file is not listed: it is `.github/agents/<agent>.agent.md`
    // for all 27, so the column only repeated the name and was paid on every
    // injection. Deriving it here keeps the same guarantee — the existence of
    // the file is still checked — without carrying the path in the prose.
    if (!/^[a-z][a-z0-9.-]*$/.test(agent)) continue
    const model = cells[1].replace(/`/g, '')
    if (!model.includes('Provider')) continue
    rows.set(agent, {
      model,
      fallback: cells[2].replace(/`/g, ''),
      skill: `${AGENTS_DIR}/${agent}.agent.md`,
    })
  }
  return rows
}

/** Agents that actually exist on disk. */
export function listAgents(root, dir = AGENTS_DIR) {
  const full = path.join(root, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith('.agent.md'))
    .map((f) => f.replace(/\.agent\.md$/, ''))
    .filter((a) => !NOT_AN_AGENT.has(a))
    .sort()
}

/**
 * La distribución de agentes por provider, derivada del registro.
 *
 * Existe porque `.vscode/README.md` publica el mismo reparto en otra proyección
 * —cuántos agentes dependen de cada provider— y esa copia derivó: hasta el
 * 2026-09-20 decía `22` para DeepSeek y `8` para Zai sobre un registro de **15**
 * y **9**, con una suma de 33 sobre las 27 filas. El número no es prosa: es la
 * instrucción con la que el Owner dimensiona la capacidad de cada provider, y
 * un reparto mal copiado deja corto al picker en medio de un ciclo.
 *
 * @returns {Map<string, number>} provider en minúsculas -> cantidad de agentes
 */
export function providerDistribution(rows) {
  const dist = new Map()
  for (const { model } of rows.values()) {
    const m = model.match(/-\s*Provider\s*-\s*(.+)$/i)
    if (!m) continue
    const provider = m[1].trim().toLowerCase()
    dist.set(provider, (dist.get(provider) ?? 0) + 1)
  }
  return dist
}

/** Dónde vive la tabla de providers: raíz instalada, o payload del repo fuente. */
export const PROVIDER_TABLE_ARTIFACTS = ['.vscode/README.md', 'scaffold/.vscode/README.md']

/**
 * Lee las filas `| Provider | Modelo | Agentes | Uso |` de la tabla de providers.
 * Las celdas no numéricas se ignoran: el encabezado, el separador de markdown y
 * la fila de NVIDIA, que es un fallback y no tiene agentes propios.
 *
 * @returns {Map<string, number>} provider en minúsculas -> cantidad declarada
 */
export function parseProviderTable(text) {
  const declared = new Map()
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 5) continue
    const provider = cells[1]
    const count = cells[3]
    if (!/^[A-Za-z]+$/.test(provider)) continue
    if (!/^\d+$/.test(count)) continue
    declared.set(provider.toLowerCase(), Number(count))
  }
  return declared
}

/**
 * Compara la tabla publicada contra la distribución derivada del registro.
 * Un provider del registro que no está en la tabla es un agente cuya capacidad
 * el Owner no puede dimensionar; uno de la tabla que el registro no asigna es
 * capacidad configurada para nadie.
 *
 * @returns {string[]} discrepancias, vacías si coinciden
 */
export function auditProviderCounts(root, rows) {
  const full = PROVIDER_TABLE_ARTIFACTS.map((p) => path.join(root, p)).find((p) => fs.existsSync(p))
  if (!full) return []
  const rel = path.relative(root, full)
  const dist = providerDistribution(rows)
  const declared = parseProviderTable(fs.readFileSync(full, 'utf8'))
  if (declared.size === 0) return [`TABLA ILEGIBLE  ${rel} existe pero no se le leyó ninguna fila de provider`]

  const problems = []
  for (const [provider, count] of dist) {
    if (!declared.has(provider)) {
      problems.push(`FALTA PROVIDER  ${provider} tiene ${count} agente(s) en el registro y no aparece en ${rel}`)
    } else if (declared.get(provider) !== count) {
      problems.push(`CONTEO  ${provider}: ${rel} dice ${declared.get(provider)}, el registro tiene ${count}`)
    }
  }
  for (const [provider, count] of declared) {
    if (!dist.has(provider) && count !== 0) {
      problems.push(`PROVIDER FANTASMA  ${rel} declara ${count} agente(s) para ${provider} y el registro no le asigna ninguno`)
    }
  }
  return problems
}

/**
 * Audits routing integrity.
 * @returns {{ registered: number, unrouted: string[], orphanRows: string[],
 *             missingModel: string[], missingFallback: string[], badSkillPath: string[],
 *             providerCountErrors: string[] }}
 */
export function auditAgentRouting(root) {
  const registryPath = path.join(root, REGISTRY)
  const rows = fs.existsSync(registryPath) ? parseRegistry(fs.readFileSync(registryPath, 'utf8')) : new Map()
  const agents = listAgents(root)

  const unrouted = agents.filter((a) => !rows.has(a))
  const orphanRows = [...rows.keys()].filter((a) => !agents.includes(a))
  const missingModel = []
  const missingFallback = []
  const badSkillPath = []

  for (const [agent, r] of rows) {
    if (!r.model) missingModel.push(agent)
    if (!r.fallback) missingFallback.push(agent)
    if (!fs.existsSync(path.join(root, r.skill))) badSkillPath.push(`${agent} -> ${r.skill}`)
  }

  return {
    registered: rows.size,
    unrouted,
    orphanRows,
    missingModel,
    missingFallback,
    badSkillPath,
    providerCountErrors: auditProviderCounts(root, rows),
  }
}

function main() {
  const root = process.cwd()
  const r = auditAgentRouting(root)

  console.log('=== AOI Agent Routing Integrity ===')
  console.log(`Registry: ${r.registered} agent(s) mapped to a model, a fallback and a definition file`)

  const failures = [
    ...r.unrouted.map((a) => `UNROUTABLE      ${a} exists in ${AGENTS_DIR}/ but has no registry row`),
    ...r.orphanRows.map((a) => `STALE ROW       ${a} is registered but has no .agent.md file`),
    ...r.missingModel.map((a) => `NO MODEL        ${a} has no runSubagent model parameter`),
    ...r.missingFallback.map((a) => `NO FALLBACK     ${a} has no fallback provider`),
    ...r.badSkillPath.map((s) => `BAD SKILL PATH  ${s}`),
    ...r.providerCountErrors,
  ]

  // Zero rows is not "everything resolves"; it is nothing to resolve. An
  // affirmative verdict over an empty input set is the same false green this
  // repository keeps finding elsewhere — a registry emptied by a bad merge, or
  // a gate pointed at the wrong directory, would print a checkmark.
  if (r.registered === 0) {
    console.error('\n❌ El registro de ruteo está vacío: cero agentes.')
    console.error('Un veredicto afirmativo sobre cero entradas no dice que todo resuelve, dice que no hay nada.')
    process.exit(1)
  }

  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    console.error('\nDelegation depends on this table. A missing row is an agent that cannot be invoked.')
    process.exit(1)
  }

  console.log('✅ Every agent resolves to a model, a fallback and an existing definition.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
