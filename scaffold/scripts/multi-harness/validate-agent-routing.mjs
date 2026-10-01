#!/usr/bin/env node
/**
 * scripts/multi-harness/validate-agent-routing.mjs
 *
 * Guarantees that every agent is routable and that its declared CATEGORY is one the
 * system knows.
 *
 * The registry in `agent-delegation.instructions.md` is not documentation about the
 * routing — it IS the routing. It maps each agent to the category of model it needs and
 * to the file that defines it. An agent missing from that table cannot be delegated to;
 * an agent whose skill path is wrong delegates into nothing.
 *
 * **The table used to carry the model and its fallback, and no longer does.** Those
 * columns declared which provider serves each agent — a fact about the machine, not about
 * the repository — and produced three measured defects before they were retired: nine
 * agents pointing at an id that had stopped existing after the provider moved a version, a
 * provider in use with no row in the conversion table, and two transports documented as
 * one. The model of each agent is chosen at setup, changes only through `/aoi-providers`,
 * and lives as O(1) facts under `{WORKSPACE}.assignment.*`.
 *
 * The split is deliberate: WHAT a category is, the repo can know. WHICH provider serves
 * it is a decision of the Owner in each workspace.
 *
 * Zero inference tokens: it reads the table and the agents directory.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REGISTRY = '.github/instructions/agent-delegation.instructions.md'
export const AGENTS_DIR = '.github/agents'

/**
 * Las categorías de modelo que un agente puede requerir.
 *
 * Es la única parte de la asignación que vive en el repo. QUÉ modelo sirve a cada
 * agente se elige en el setup entre los proveedores que la máquina tenga configurados:
 * el repositorio no puede saber qué cuentas existen, y escribirlo acá
 * produjo tres defectos medidos —un id muerto, un proveedor sin fila de conversión y
 * dos transportes sin reconciliar— todos por declarar en el repo algo que sólo la
 * máquina sabe.
 */
export const CATEGORIES = ['Razonamiento', 'Implementación']
/** Files that describe the protocol rather than an agent the registry must list. */
const NOT_AN_AGENT = new Set([])

/**
 * Parses the registry rows.
 * @returns {Map<string, {category: string, skill: string}>}
 */
export function parseRegistry(text) {
  const rows = new Map()
  for (const line of text.split('\n')) {
    if (!line.startsWith('| `')) continue
    const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    if (cells.length < 2) continue
    const agent = cells[0].replace(/`/g, '').replace(/^@/, '')
    // The definition file is not listed: it is `.github/agents/<agent>.agent.md`
    // for all 27, so the column only repeated the name and was paid on every
    // injection. Deriving it here keeps the same guarantee — the existence of
    // the file is still checked — without carrying the path in the prose.
    if (!/^[a-z][a-z0-9.-]*$/.test(agent)) continue
    // La categoría se acepta sin validar el vocabulario a propósito: filtrar acá
    // convertiría una categoría mal escrita en "agente sin fila", y el veredicto
    // nombraría al agente en vez del valor. `auditAgentRouting` la reporta aparte.
    const category = cells[1].replace(/`/g, '').trim()
    if (!category) continue
    rows.set(agent, { category, skill: `${AGENTS_DIR}/${agent}.agent.md` })
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
 * La distribución de agentes por CATEGORÍA, derivada del registro.
 *
 * Antes derivaba provider -> cantidad de agentes, y esa tabla se publicaba en
 * `.vscode/README.md`. Con la asignación resuelta en `/init` el reparto por provider
 * no es un hecho del repo: es una decisión del Owner en cada workspace. Publicarlo
 * habría sido publicar un número que el propio diseño hace dinámico. La categoría, en
 * cambio, sí es estática y sigue mereciendo un conteo verificado.
 *
 * @returns {Map<string, number>} categoría -> cantidad de agentes
 */
export function categoryDistribution(rows) {
  const dist = new Map()
  for (const { category } of rows.values()) {
    dist.set(category, (dist.get(category) ?? 0) + 1)
  }
  return dist
}

/** Dónde vive la tabla de categorías: raíz instalada, o payload del repo fuente. */
export const CATEGORY_TABLE_ARTIFACTS = ['.vscode/README.md', 'scaffold/.vscode/README.md']

/**
 * Lee las filas `| Categoría | Agentes | Uso |` de la tabla publicada.
 * Las celdas no numéricas se ignoran, incluido el separador de markdown.
 *
 * @returns {Map<string, number>} categoría en minúsculas -> cantidad declarada
 */
export function parseCategoryTable(text) {
  const declared = new Map()
  for (const line of text.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    if (!/^[A-Za-zÀ-ÿ]+$/.test(cells[1])) continue
    if (!/^\d+$/.test(cells[2])) continue
    declared.set(cells[1].toLowerCase(), Number(cells[2]))
  }
  return declared
}

/**
 * Compara la tabla publicada contra la distribución derivada del registro.
 * Una categoría del registro que falta en la tabla es un agente cuya capacidad el
 * Owner no puede dimensionar; una de la tabla que el registro no usa es capacidad
 * declarada para nadie.
 *
 * @returns {string[]} discrepancias, vacías si coinciden
 */
export function auditCategoryCounts(root, rows) {
  const full = CATEGORY_TABLE_ARTIFACTS.map((p) => path.join(root, p)).find((p) => fs.existsSync(p))
  if (!full) return []
  const rel = path.relative(root, full)
  const dist = categoryDistribution(rows)
  const declared = parseCategoryTable(fs.readFileSync(full, 'utf8'))
  if (declared.size === 0) return [`TABLA ILEGIBLE  ${rel} existe pero no se le leyó ninguna fila de categoría`]

  const problems = []
  for (const [category, count] of dist) {
    if (!declared.has(category.toLowerCase())) {
      problems.push(`FALTA CATEGORÍA  ${category} tiene ${count} agente(s) en el registro y no aparece en ${rel}`)
    } else if (declared.get(category.toLowerCase()) !== count) {
      problems.push(`CONTEO  ${category}: ${rel} dice ${declared.get(category.toLowerCase())}, el registro tiene ${count}`)
    }
  }
  for (const [category, count] of declared) {
    if (![...dist.keys()].some((c) => c.toLowerCase() === category) && count !== 0) {
      problems.push(`CATEGORÍA FANTASMA  ${rel} declara ${count} agente(s) para ${category} y el registro no la usa`)
    }
  }
  return problems
}

/**
 * Audits routing integrity: todo agente tiene fila, toda fila tiene un archivo y una
 * categoría del vocabulario.
 *
 * Ya no valida `model` ni `fallback`: esas columnas se retiraron del registro porque
 * declaraban en el repo algo que sólo la máquina sabe. Su garantía vive ahora en
 * `provider-assignment.mjs`, que resuelve contra la configuración real.
 *
 * @returns {{ registered: number, unrouted: string[], orphanRows: string[],
 *             unknownCategory: string[], badSkillPath: string[], categoryCountErrors: string[] }}
 */
export function auditAgentRouting(root) {
  const registryPath = path.join(root, REGISTRY)
  const rows = fs.existsSync(registryPath) ? parseRegistry(fs.readFileSync(registryPath, 'utf8')) : new Map()
  const agents = listAgents(root)

  const unrouted = agents.filter((a) => !rows.has(a))
  const orphanRows = [...rows.keys()].filter((a) => !agents.includes(a))
  const unknownCategory = []
  const badSkillPath = []

  for (const [agent, r] of rows) {
    if (!CATEGORIES.includes(r.category)) unknownCategory.push(`${agent} -> "${r.category}"`)
    if (!fs.existsSync(path.join(root, r.skill))) badSkillPath.push(`${agent} -> ${r.skill}`)
  }

  return {
    registered: rows.size,
    unrouted,
    orphanRows,
    unknownCategory,
    badSkillPath,
    categoryCountErrors: auditCategoryCounts(root, rows),
  }
}

function main() {
  const root = process.cwd()
  const r = auditAgentRouting(root)

  console.log('=== AOI Agent Routing Integrity ===')
  console.log(`Registry: ${r.registered} agent(s) mapped to a category and a definition file`)
  console.log(`Categorías: ${CATEGORIES.join(', ')} (el modelo se elige en el setup; /aoi-providers lo cambia)`)

  const failures = [
    ...r.unrouted.map((a) => `UNROUTABLE      ${a} exists in ${AGENTS_DIR}/ but has no registry row`),
    ...r.orphanRows.map((a) => `STALE ROW       ${a} is registered but has no .agent.md file`),
    ...r.unknownCategory.map(
      (c) => `UNKNOWN CATEGORY  ${c} — el registro sólo admite: ${CATEGORIES.join(', ')}`,
    ),
    ...r.badSkillPath.map((s) => `BAD SKILL PATH  ${s}`),
    ...r.categoryCountErrors,
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

  console.log('✅ Every agent resolves to a known category and an existing definition file.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
