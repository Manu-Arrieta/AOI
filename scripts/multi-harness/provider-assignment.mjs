#!/usr/bin/env node
/**
 * scripts/multi-harness/provider-assignment.mjs
 *
 * Verifica que lo que el repo declara sobre la asignación de modelos sea coherente, y
 * que lo que el workspace tiene asignado exista en la máquina.
 *
 * **El repo declara sólo la CATEGORÍA.** Qué modelo sirve a cada agente se elige en el
 * setup y se cambia con `/aoi-providers` (`provider-setup.mjs`), y vive en ICM bajo
 * `{WORKSPACE}.assignment.*`. Escribir el proveedor en el repo produjo tres defectos
 * medidos: un id muerto en nueve agentes, un proveedor en uso sin fila de conversión, y
 * dos transportes sin reconciliar.
 *
 * Dos clases de chequeo, y la distinción importa:
 *
 *   - **Estáticos**: se corren siempre. Registro con categorías conocidas, y que cada
 *     bloque `## Model Requirement` declare la MISMA categoría que su fila, sin proveedor.
 *   - **De entorno**: cada valor guardado en `assignment.*` tiene que estar entre los
 *     modelos configurados. Es el chequeo que faltaba: sin él, un id muerto o un
 *     placeholder guardado quedaban en verde hasta la primera delegación. Cuando no hay
 *     configuración o no hay asignación se declaran **omitidos con su motivo**, nunca
 *     verdes.
 *
 * Cero tokens de inferencia.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverProviders, subagentValue } from './provider-config.mjs'
import { defaultWorkspace, readAssignment, storedSlots } from './provider-store.mjs'
import { AGENTS_DIR, CATEGORIES, REGISTRY, parseRegistry } from './validate-agent-routing.mjs'

export { subagentValue }

/**
 * La categoría que declara el bloque `## Model Requirement` de un agente.
 *
 * Se aceptan dos formas: `**Category**: X` y la vieja `**Model**: ...`. La segunda existe
 * sólo para que el gate pueda reportar "este agente todavía nombra un proveedor" en vez de
 * "este agente no declara categoría" — un mensaje que nombra el defecto real.
 */
export function blockCategory(text) {
  // `|$` y no sólo `\n## `: un bloque que fuera lo último del archivo no tendría
  // siguiente encabezado y el lookahead no cerraría, así que el bloque se reportaría
  // como ausente. Todos los agentes reales tienen una sección después, pero un
  // veredicto que depende del orden del archivo es un veredicto frágil.
  const block = text.match(/## Model Requirement\n[\s\S]*?(?=\n## |$)/)
  if (!block) return { present: false, category: null, namesProvider: false }
  const line = block[0]
  const cat = line.match(/\*\*Categor[íi]a\*\*:\s*([^\n·]+)/)
  // `Provider -` es la firma de un nombre de modelo escrito en duro. Se busca en todo el
  // bloque y no en una línea: la columna se movió de lugar más de una vez.
  return {
    present: true,
    category: cat ? cat[1].replace(/[`*]/g, '').trim() : null,
    namesProvider: /Provider -/.test(line),
  }
}

/**
 * @param {string} root
 * @param {{ discovered?: object, read?: object, workspace?: string }} [opts] inyectables para los tests.
 * @returns {{ agents: number, entries: number, source: string|null, stored: number,
 *             failures: string[], warnings: string[], omitted: string[] }}
 */
export function auditProviderAssignment(root, opts = {}) {
  const failures = []
  const warnings = []
  const omitted = []

  const registryPath = path.join(root, REGISTRY)
  const registry = fs.existsSync(registryPath)
    ? parseRegistry(fs.readFileSync(registryPath, 'utf8'))
    : new Map()

  // Cero filas no es "todo resuelve": es nada que resolver. Sin esta guarda un registro
  // vacío —o ausente— producía `failures: []` y el gate imprimía su veredicto afirmativo
  // sobre cero agentes. `validate-agent-routing.mjs` ya tenía la misma guarda.
  if (registry.size === 0) {
    failures.push(
      `REGISTRO VACÍO  se leyeron 0 filas de ${REGISTRY}. ` +
        'Un veredicto afirmativo sobre cero entradas no dice que todo resuelve, dice que no hay nada.',
    )
    return { agents: 0, entries: 0, source: null, stored: 0, failures, warnings, omitted }
  }

  // ── Estáticos ─────────────────────────────────────────────────────────────
  for (const [agent, row] of registry) {
    if (!CATEGORIES.includes(row.category)) {
      failures.push(
        `CATEGORÍA DESCONOCIDA  ${agent}: "${row.category}". El vocabulario es: ${CATEGORIES.join(', ')}`,
      )
    }
  }

  const agentsDir = path.join(root, AGENTS_DIR)
  const agentFiles = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.agent.md'))
    : []

  for (const file of agentFiles) {
    const agent = file.replace(/\.agent\.md$/, '')
    const block = blockCategory(fs.readFileSync(path.join(agentsDir, file), 'utf8'))
    const row = registry.get(agent)

    if (!block.present) {
      failures.push(`SIN BLOQUE  ${agent}: no tiene \`## Model Requirement\``)
      continue
    }
    if (block.namesProvider) {
      failures.push(
        `PROVEEDOR EN DURO  ${agent}: el bloque nombra un proveedor. La asignación se resuelve ` +
          'en /init y cambia por petición manual; nombrarla acá la deja obsoleta en silencio.',
      )
    }
    if (!block.category) {
      failures.push(`SIN CATEGORÍA  ${agent}: el bloque no declara \`**Categoría**:\``)
      continue
    }
    if (!row) continue // `aoi:routing` ya reporta el agente sin fila.
    if (block.category !== row.category) {
      failures.push(
        `CATEGORÍA DISCREPA  ${agent}: el bloque dice "${block.category}" y el registro "${row.category}"`,
      )
    }
  }

  // ── De entorno ────────────────────────────────────────────────────────────
  const discovered = opts.discovered ?? discoverProviders()
  const entries = discovered.entries ?? []
  const base = { agents: registry.size, entries: entries.length, source: discovered.path ?? null }

  for (const e of entries) {
    const drift = versionDrift(e)
    if (drift) warnings.push(`VERSIÓN  ${e.provider}: ${drift}`)
  }

  const read = opts.read ?? readAssignment(opts.workspace ?? defaultWorkspace(root))
  const stored = read.ok ? storedSlots(read.assignment) : []

  if (!read.ok) omitted.push(`asignación del workspace (${read.reason})`)
  else if (stored.length === 0) omitted.push('asignación del workspace (no hay nada asignado: se elige en el setup o con /aoi-providers)')
  else if (entries.length === 0) {
    omitted.push(
      'contraste de la asignación con los proveedores (no hay configuración; ' +
        `se revisaron ${discovered.considered?.length ?? 0} ubicaciones)`,
    )
  } else {
    const available = new Set(entries.map(subagentValue))
    for (const { key, value } of stored) {
      if (!available.has(value)) {
        failures.push(
          `ASIGNACIÓN MUERTA  ${key} = "${value}" no está entre los modelos configurados. ` +
            'Delegar con ese valor falla con "Requested model not found". Corré /aoi-providers.',
        )
      }
    }
  }

  return { ...base, stored: stored.length, failures, warnings, omitted }
}

/** Un `id` y su `name` que discrepan en el token de versión. */
export function versionDrift(entry) {
  const versionOf = (s) => (String(s ?? '').match(/(\d+)\.(\d+)/) ?? []).slice(1).join('.')
  const fromId = versionOf(entry.id)
  const fromName = versionOf(entry.name)
  if (!fromId || !fromName || fromId === fromName) return null
  return `${entry.id} -> "${entry.name}" (id declara ${fromId}, name declara ${fromName})`
}

function main() {
  const r = auditProviderAssignment(process.cwd())

  console.log('=== AOI Provider Assignment ===')
  console.log(`Registro:    ${r.agents} agente(s) con categoría`)
  console.log(`Proveedores: ${r.entries} modelo(s) desde ${r.source ?? '(sin configuración)'}`)
  console.log(`Asignación:  ${r.stored} slot(s) guardado(s)`)

  for (const w of r.warnings) console.log(`⚠️  ${w}`)

  if (r.failures.length > 0) {
    console.error('')
    for (const f of r.failures) console.error(`❌ ${f}`)
    process.exit(1)
  }

  for (const o of r.omitted) console.log(`⏭️  OMITIDO: ${o}`)
  console.log(
    r.omitted.length > 0
      ? '\n✅ Registro y bloques coherentes. Lo OMITIDO no quedó verificado.'
      : '\n✅ Registro y bloques coherentes, y cada modelo asignado está configurado en esta máquina.',
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
