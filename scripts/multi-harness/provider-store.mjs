#!/usr/bin/env node
/**
 * scripts/multi-harness/provider-store.mjs
 *
 * La asignación `agente → modelo` de un workspace: dónde se guarda, cómo se resuelve y
 * cómo se lee en cada delegación.
 *
 * Existe porque la versión anterior tenía sólo el lado que ESCRIBE. `/init` persistía
 * `assignment.*` y la delegación seguía leyendo el modelo de una columna del registro que
 * ya no existía. Lo que lo compensaba en el papel —"`icm wake-up` carga los facts"— era
 * falso, medido el 2026-09-28: `wake-up` selecciona memorias critical/high, y dos facts
 * reales de `AOI` aparecieron 0 veces en su salida. Por eso la lectura es un comando
 * (`--resolve`) y no una suposición sobre qué hay en contexto.
 *
 * El repositorio no trae asignación: se elige en el setup y sólo cambia con
 * `/aoi-providers`. Resolución, de lo más específico a lo más general:
 *
 *   assignment.agent.<agente>      override de un agente
 *   assignment.category.<slug>     el de su categoría
 *   assignment.default             uno para todos
 *
 * Sin ninguno, el agente queda SIN ASIGNAR y la delegación se detiene: elegir por el
 * Owner es exactamente lo que esta asignación existe para no hacer.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverProviders, subagentValue } from './provider-config.mjs'
import { parseRegistry } from './validate-agent-routing.mjs'
import { parseFactTable, noFacts } from '../sdd-lifecycle/contract-facts.mjs'

export const PREFIX = 'assignment.'
export const DEFAULT_KEY = 'assignment.default'
export const RESOLVED_AT_KEY = 'assignment.resolvedAt'
export const REGISTRY = '.github/instructions/agent-delegation.instructions.md'

/**
 * La categoría como segmento de clave. Sin tildes a propósito: la clave viaja por
 * shells y por `icm`, y `Implementación` con y sin tilde serían dos slots distintos
 * que se leen igual.
 */
export function categorySlug(category) {
  return String(category).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export const agentKey = (agent) => `${PREFIX}agent.${agent}`
export const categoryKey = (category) => `${PREFIX}category.${categorySlug(category)}`

/**
 * Las filas `assignment.*` de `icm facts list`, en forma estructurada.
 * @returns {{ default: string|null, categories: Map<string,string>, agents: Map<string,string>,
 *             resolvedAt: string|null }}
 */
export function parseAssignment(facts) {
  const out = { default: null, categories: new Map(), agents: new Map(), resolvedAt: null }
  for (const { key, value } of facts) {
    if (key === DEFAULT_KEY) out.default = value
    else if (key === RESOLVED_AT_KEY) out.resolvedAt = value
    else if (key.startsWith(`${PREFIX}category.`)) out.categories.set(key.slice(`${PREFIX}category.`.length), value)
    else if (key.startsWith(`${PREFIX}agent.`)) out.agents.set(key.slice(`${PREFIX}agent.`.length), value)
  }
  return out
}

/**
 * El modelo de un agente y de qué nivel sale.
 * @returns {{ value: string|null, source: 'agent'|'category'|'default'|null }}
 */
export function resolveAgent(agent, category, assignment) {
  if (assignment.agents.has(agent)) return { value: assignment.agents.get(agent), source: 'agent' }
  const slug = categorySlug(category ?? '')
  if (assignment.categories.has(slug)) return { value: assignment.categories.get(slug), source: 'category' }
  if (assignment.default) return { value: assignment.default, source: 'default' }
  return { value: null, source: null }
}

/** Los slots guardados como pares clave/valor, sin `resolvedAt`, que no es un modelo. */
export function storedSlots(assignment) {
  return [
    ...(assignment.default ? [{ key: DEFAULT_KEY, value: assignment.default }] : []),
    ...[...assignment.categories].map(([slug, value]) => ({ key: `${PREFIX}category.${slug}`, value })),
    ...[...assignment.agents].map(([agent, value]) => ({ key: agentKey(agent), value })),
  ]
}

/** ¿Hay algo guardado? Decide si el setup pregunta o respeta lo que ya existe. */
export const isEmpty = (assignment) => storedSlots(assignment).length === 0

/**
 * `icm` como dependencia inyectable: los tests pasan un doble y no tocan la base real.
 * @typedef {(args: string[]) => string} IcmExec
 */
export const icmExec = (args) =>
  execFileSync('icm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

/**
 * Lee la asignación del workspace. Nunca lanza: `ok: false` distingue "icm no está" de
 * "no hay asignación", que un lector que sólo mirara el resultado confundiría.
 * @returns {{ ok: boolean, assignment: ReturnType<typeof parseAssignment>, reason?: string }}
 */
export function readAssignment(workspace, exec = icmExec) {
  let text
  try {
    text = exec(['facts', 'list', workspace, '-p', PREFIX, '--read-only'])
  } catch (e) {
    return { ok: false, assignment: parseAssignment([]), reason: `icm no respondió: ${e.message.split('\n')[0]}` }
  }
  return { ok: true, assignment: parseAssignment(noFacts(text) ? [] : parseFactTable(text)) }
}

/** Escribe un slot. `set` sobre una clave existente la supersede con historial. */
export function writeFact(workspace, key, value, exec = icmExec) {
  exec(['facts', 'set', workspace, key, value])
}

/** Borra un slot entero, incluido su historial. */
export function forgetFact(workspace, key, exec = icmExec) {
  exec(['facts', 'forget', workspace, key])
}

/** Agentes del registro con su categoría, en el orden del registro. */
export function registryAgents(root) {
  const file = path.join(root, REGISTRY)
  if (!fs.existsSync(file)) return []
  return [...parseRegistry(fs.readFileSync(file, 'utf8'))].map(([agent, r]) => ({ agent, category: r.category }))
}

/**
 * ¿El valor resuelto existe en esta máquina? `null` si sí o si no hay contra qué
 * comparar (CI, sin VS Code); el motivo si no existe.
 *
 * Medido en AOI TESTS el 2026-09-30: con un valor muerto inyectado, `aoi:providers`
 * fallaba pero `--resolve` lo entregaba igual, y la delegación recién habría fallado
 * dentro de `runSubagent`. Comparar acá cuesta leer un archivo local.
 */
export function unavailableReason(value, discovered) {
  const entries = discovered?.entries ?? []
  if (entries.length === 0 || entries.some((e) => subagentValue(e) === value)) return null
  return `"${value}" ya no está entre los modelos configurados en esta máquina`
}

/** El workspace de ICM es el nombre del directorio, como lo registra `setup.sh`. */
export const defaultWorkspace = (root) => path.basename(path.resolve(root))

function main() {
  const args = process.argv.slice(2)
  const at = args.indexOf('--resolve')
  const agent = at >= 0 ? args[at + 1] : null
  if (!agent) {
    console.error('Uso: node scripts/multi-harness/provider-store.mjs --resolve <agente> [--workspace <ws>]')
    process.exit(2)
  }
  const root = process.cwd()
  const wsAt = args.indexOf('--workspace')
  const workspace = wsAt >= 0 ? args[wsAt + 1] : defaultWorkspace(root)

  const row = registryAgents(root).find((r) => r.agent === agent)
  if (!row) {
    console.error(`❌ ${agent} no está en el registro de ${REGISTRY}.`)
    process.exit(2)
  }
  const read = readAssignment(workspace)
  if (!read.ok) {
    console.error(`❌ ${read.reason}`)
    process.exit(2)
  }
  const { value } = resolveAgent(agent, row.category, read.assignment)
  if (!value) {
    console.error(`❌ ${agent} no tiene modelo asignado en ${workspace}. NO delegues: pedile al Owner que corra /aoi-providers.`)
    process.exit(3)
  }
  const gone = unavailableReason(value, discoverProviders())
  if (gone) {
    console.error(`❌ ${agent}: ${gone}. NO delegues: pedile al Owner que corra /aoi-providers.`)
    process.exit(4)
  }
  // Sólo el valor, sin decoración: es lo que va tal cual en `runSubagent({ model })`.
  console.log(value)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
