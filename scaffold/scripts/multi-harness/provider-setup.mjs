#!/usr/bin/env node
/**
 * scripts/multi-harness/provider-setup.mjs
 *
 * Elige y cambia la asignación de modelos de un workspace. Es la ÚNICA vía de escritura:
 * la llaman el setup (`--interactive --if-empty`) y `/aoi-providers` (`--set`, `--unset`,
 * `--reset`). Nada más escribe `assignment.*`, y eso es el requisito, no un detalle: el
 * Owner decidió que la asignación sólo cambia cuando él lo pide.
 *
 * Tres niveles —todos, por categoría, por agente— y se resuelven en ese orden inverso
 * (`provider-store.mjs`). Un valor sólo se acepta si está entre los modelos que la máquina
 * tiene configurados: guardar uno que no está es mover un "Requested model not found" al
 * medio de un ciclo, que es el defecto que dio origen a todo esto.
 *
 * Lo que NO hace: probar si el modelo responde. `runSubagent` es de la sesión del
 * asistente y un script no lo tiene. Esa prueba es un paso de `/aoi-providers`.
 */

import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { discoverProviders, formatReport, subagentValue } from './provider-config.mjs'
import {
  DEFAULT_KEY, RESOLVED_AT_KEY, agentKey, categoryKey, defaultWorkspace, forgetFact, icmExec,
  isEmpty, parseAssignment, readAssignment, registryAgents, resolveAgent, storedSlots, writeFact,
} from './provider-store.mjs'
import { CATEGORIES } from './validate-agent-routing.mjs'

/** Los valores elegibles, uno por modelo configurado, en el orden del manifiesto. */
export function modelChoices(discovered) {
  return (discovered?.entries ?? []).map((e) => ({ value: subagentValue(e), provider: e.provider }))
}

/**
 * `all` · `category:<Categoría>` · `agent:<agente>` → la clave del slot.
 * Un alcance que no existe se rechaza nombrándolo: escribirlo igual dejaría un fact que
 * ningún agente lee.
 */
export function scopeKey(scope, agents) {
  if (scope === 'all') return DEFAULT_KEY
  const [kind, ...rest] = scope.split(':')
  const name = rest.join(':')
  if (kind === 'category') {
    const cat = CATEGORIES.find((c) => c.toLowerCase() === name.toLowerCase())
    if (!cat) throw new Error(`categoría desconocida "${name}". Válidas: ${CATEGORIES.join(', ')}`)
    return categoryKey(cat)
  }
  if (kind === 'agent') {
    if (!agents.some((a) => a.agent === name)) throw new Error(`agente desconocido "${name}"`)
    return agentKey(name)
  }
  throw new Error(`alcance inválido "${scope}". Usá all, category:<Categoría> o agent:<agente>`)
}

/** `#3` o el valor exacto → el valor. Fuera de la lista es un error, nunca un pase. */
export function pickValue(input, choices) {
  const s = String(input).trim()
  const n = s.match(/^#?(\d+)$/)
  if (n) {
    const c = choices[Number(n[1]) - 1]
    if (!c) throw new Error(`no hay modelo #${n[1]} (hay ${choices.length})`)
    return c.value
  }
  if (!choices.some((c) => c.value === s)) {
    throw new Error(`"${s}" no está entre los modelos configurados en esta máquina`)
  }
  return s
}

/** Cada agente con su modelo resuelto y de dónde sale. */
export function resolvedTable(agents, assignment) {
  return agents.map(({ agent, category }) => ({ agent, category, ...resolveAgent(agent, category, assignment) }))
}

export function formatTable(rows) {
  const unassigned = rows.filter((r) => !r.value).length
  const lines = rows.map(
    (r) => `  ${r.agent.padEnd(24)} ${r.category.padEnd(15)} ${r.value ?? '— SIN ASIGNAR —'}${r.source ? `  [${r.source}]` : ''}`,
  )
  if (unassigned) lines.push('', `⚠️  ${unassigned} agente(s) sin asignar: no se pueden delegar. Corré /aoi-providers.`)
  return lines.join('\n')
}

export function formatChoices(choices) {
  return choices.map((c, i) => `  #${String(i + 1).padEnd(3)} ${c.value}`).join('\n')
}

/**
 * El diálogo del setup. `ask` es inyectable: los tests lo contestan sin terminal.
 * Devuelve las escrituras, no las ejecuta — confirmar y escribir es del llamador.
 *
 * @returns {Promise<Array<{ key: string, value: string }>>}
 */
export async function interactiveWrites(agents, choices, ask, say = console.log) {
  const writes = []
  const choose = async (label, optional) => {
    for (;;) {
      const answer = (await ask(`${label}${optional ? ' (Enter = heredar)' : ''}: `)).trim()
      if (!answer && optional) return null
      try {
        return pickValue(answer, choices)
      } catch (e) {
        say(`   ${e.message}`)
      }
    }
  }
  const yes = async (q) => /^s(i|í)?$/i.test((await ask(`${q} [s/N]: `)).trim())

  say('\nModelos configurados en esta máquina:\n' + formatChoices(choices) + '\n')
  writes.push({ key: DEFAULT_KEY, value: await choose('Modelo para TODOS los agentes (#n)', false) })

  if (await yes('¿Un modelo distinto por categoría?')) {
    for (const cat of CATEGORIES) {
      const v = await choose(`  ${cat}`, true)
      if (v) writes.push({ key: categoryKey(cat), value: v })
    }
  }
  if (await yes('¿Algún agente con un modelo propio?')) {
    for (const { agent } of agents) {
      const v = await choose(`  ${agent}`, true)
      if (v) writes.push({ key: agentKey(agent), value: v })
    }
  }
  return writes
}

/** Aplica las escrituras y sella `resolvedAt`. `reset` borra antes lo que había. */
export function applyWrites(workspace, writes, { reset = false, existing = [], exec = icmExec, now = new Date() } = {}) {
  if (reset) for (const key of existing) forgetFact(workspace, key, exec)
  for (const w of writes) {
    if (w.value === null) forgetFact(workspace, w.key, exec)
    else writeFact(workspace, w.key, w.value, exec)
  }
  writeFact(workspace, RESOLVED_AT_KEY, now.toISOString(), exec)
}

/** Las claves guardadas, para que `--reset` sepa qué borrar. */
export const existingKeys = (assignment) => storedSlots(assignment).map((s) => s.key)

function flagValues(args, flag) {
  const out = []
  args.forEach((a, i) => a === flag && args[i + 1] && out.push(args[i + 1]))
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const root = path.resolve(flagValues(args, '--root')[0] ?? process.cwd())
  const workspace = flagValues(args, '--workspace')[0] ?? defaultWorkspace(root)
  const agents = registryAgents(root)
  if (agents.length === 0) {
    console.error(`❌ Registro vacío o ausente en ${root}: no hay agentes que asignar.`)
    process.exit(2)
  }
  const read = readAssignment(workspace)
  if (!read.ok) {
    console.error(`❌ ${read.reason}`)
    process.exit(2)
  }
  const discovered = discoverProviders()
  const choices = modelChoices(discovered)

  if (args.includes('--list-models')) return console.log(choices.length ? formatChoices(choices) : formatReport(discovered))
  if (args.includes('--show')) return console.log(`Asignación de ${workspace}:\n` + formatTable(resolvedTable(agents, read.assignment)))

  if (args.includes('--interactive')) {
    if (args.includes('--if-empty') && !isEmpty(read.assignment)) {
      console.log(`Asignación existente de ${workspace} — se conserva. Para cambiarla: /aoi-providers\n`)
      return console.log(formatTable(resolvedTable(agents, read.assignment)))
    }
    if (choices.length === 0) {
      console.log(formatReport(discovered))
      return console.log('\nLos agentes quedan SIN ASIGNAR. Cuando agregues proveedores, corré /aoi-providers.')
    }
    // Un iterador de líneas y no `rl.question`: con la entrada por tubería, `question`
    // perdía las líneas que llegaban antes de la pregunta y el diálogo se cortaba en
    // la segunda — medido. El iterador las guarda en buffer.
    const rl = readline.createInterface({ input: process.stdin })
    const lines = rl[Symbol.asyncIterator]()
    const ask = async (q) => {
      process.stdout.write(q)
      const { value, done } = await lines.next()
      if (done) throw new Error('la entrada terminó antes de completar la asignación: no se guardó nada')
      return value
    }
    try {
      const writes = await interactiveWrites(agents, choices, ask)
      const preview = resolvedTable(agents, parseAssignment(writes))
      console.log('\n' + formatTable(preview))
      if (/^n/i.test((await ask('\n¿Guardar esta asignación? [S/n]: ')).trim())) {
        return console.log('No se guardó nada. Los agentes quedan SIN ASIGNAR: corré /aoi-providers.')
      }
      applyWrites(workspace, writes, { reset: true, existing: existingKeys(read.assignment) })
      return console.log(`✅ Asignación guardada en ICM (${workspace}.assignment.*).`)
    } finally {
      rl.close()
    }
  }

  const sets = flagValues(args, '--set')
  const unsets = flagValues(args, '--unset')
  const reset = args.includes('--reset')
  if (sets.length + unsets.length === 0 && !reset) {
    console.error('Uso: --show | --list-models | --interactive [--if-empty] | [--reset] --set <alcance>=<#n|valor> | --unset <alcance>')
    process.exit(2)
  }
  let writes
  try {
    writes = [
      ...sets.map((s) => {
        const eq = s.indexOf('=')
        if (eq < 0) throw new Error(`--set espera <alcance>=<valor>, recibió "${s}"`)
        return { key: scopeKey(s.slice(0, eq), agents), value: pickValue(s.slice(eq + 1), choices) }
      }),
      ...unsets.map((s) => ({ key: scopeKey(s, agents), value: null })),
    ]
  } catch (e) {
    console.error(`❌ ${e.message}`)
    process.exit(1)
  }
  applyWrites(workspace, writes, { reset, existing: existingKeys(read.assignment) })
  console.log(`✅ Asignación de ${workspace} actualizada:\n` + formatTable(resolvedTable(agents, readAssignment(workspace).assignment)))
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(`\n❌ ${e.message}`)
    process.exit(1)
  })
}
