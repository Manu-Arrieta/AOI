#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/audit-task-artifacts.mjs
 *
 * ¿La fase produjo lo que su contrato declara, en ESTA corrida?
 *
 * `phase-handoffs.mjs` audita el CONTRATO: que cada artefacto que una fase exige
 * lo produzca una anterior, y que los prompts se nombren entre sí. Eso dice si
 * la cadena es coherente; no dice si el ciclo que acaba de correr dejó los
 * archivos. Son dos preguntas distintas y hasta ahora sólo existía la primera:
 * verificado, `phase-handoffs.mjs` no tiene un solo `existsSync` sobre
 * artefactos de tarea, y `registry-sync.mjs` usa `existsSync` para enumerar
 * tareas, no para exigir productos.
 *
 * El hueco tiene precedente medido. `token-tool-coverage.mjs` documenta que
 * `context-tombstone` "worked, was tested, and the benchmark credited it 1.085
 * tokens a cycle — but no prompt and no agent ever invoked it. The benchmark
 * counted a saving the real cycle could not obtain." Es la misma forma, un
 * nivel más arriba: el contrato se verifica, la ejecución no.
 *
 * Aritmética de filesystem: 0 tokens de inferencia.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HANDOFFS } from './phase-handoffs.mjs'

/**
 * Artefactos que NO son archivos, y por lo tanto este instrumento no puede
 * verificar por presencia.
 *
 * `sbc-facts` y `bic-facts` son familias de hechos O(1) que viajan por ICM
 * —`phase-handoffs.mjs` los reconoce por su prefijo de clave, `sbc.` y `bic.`,
 * justamente porque no hay archivo—. Buscarlos en disco da "faltante" en TODA
 * tarea, para siempre: una compuerta que siempre falla se aprende a ignorar, y
 * eso es peor que no tenerla. Se declaran acá para reportarlos como lo que son.
 *
 * `blueprint-diagrams` es del WORKSPACE (`.blueprints/{SBC}/diagrams/`), no del
 * repo, y además es CONDICIONAL: se produce sólo si el SBC declaró cruces y
 * Archify está instalado. Se declara por la misma razón.
 */
export const NON_FILE_ARTIFACTS = {
  'sbc-facts': 'hechos ICM (prefijo sbc.)',
  'bic-facts': 'hechos ICM (prefijo bic.)',
  'blueprint-diagrams': 'artefacto del WORKSPACE, condicional',
}

/**
 * Artefactos que no viven en la carpeta de la tarea.
 *
 * `registry.md` lo produce `/sdd-new` y es un documento vivo que todas las
 * fases mutan y que leen humanos: vive en `.tasks/registry.md`, no bajo
 * `TASK-YYYY-NNN/`. Un resolvedor que sólo mirara la carpeta de la tarea lo
 * reportaría faltante en todas.
 */
export const ROOT_ARTIFACTS = { 'registry.md': '.tasks/registry.md' }

/** Clasifica un artefacto por dónde vive. Pura: no toca el disco. */
export function classifyArtifact(name) {
  if (NON_FILE_ARTIFACTS[name]) return 'non-file'
  if (ROOT_ARTIFACTS[name]) return 'root'
  return 'task'
}

/** Ruta absoluta de un artefacto, o null cuando no es verificable por archivo. */
export function artifactPath(root, taskDir, artifact) {
  const kind = classifyArtifact(artifact)
  if (kind === 'non-file') return null
  if (kind === 'root') return path.join(root, ROOT_ARTIFACTS[artifact])
  return path.join(taskDir, artifact)
}

/**
 * ¿La fase corrió?
 *
 * Se decide por sus PRODUCTOS, no por una marca: no hay ninguna en disco, y
 * inferirla de otra cosa sería adivinar. Una fase que no dejó ninguno de sus
 * artefactos duros no corrió; el ciclo la salteó, o todavía no llegó.
 *
 * El caso que esto habilita es el que importa: una fase que dejó ALGUNOS de sus
 * productos corrió a medias. `Phase_2_FF` produce cuatro archivos, y tres de
 * cuatro es un ciclo que se cortó en el medio.
 */
export function phaseRan(produces, present) {
  return produces.some((a) => present.has(a))
}

/**
 * Audita UNA tarea contra el contrato.
 *
 * @param {string} root repo root
 * @param {{id: string, feature: string}} task
 * @param {Array} chain HANDOFFS
 * @returns {{id, feature, findings: string[], ran: string[]}}
 */
export function auditTask(root, task, chain = HANDOFFS) {
  const taskDir = path.join(root, '.tasks', task.feature, task.id)
  const findings = []
  const ran = []

  /** Presencia de un artefacto. `null` = no verificable por archivo. */
  const presence = (artifact) => {
    const full = artifactPath(root, taskDir, artifact)
    if (full === null) return null
    try {
      // Un archivo de 0 bytes no es un artefacto producido. Declarar que sí lo
      // es convierte "se creó el archivo" en "se hizo el trabajo".
      return fs.statSync(full).size > 0
    } catch {
      return false
    }
  }

  for (const step of chain) {
    const produces = step.produces ?? []
    const requires = step.requires ?? []
    const present = new Set(produces.filter((a) => presence(a) === true))

    if (!phaseRan(produces, present)) continue
    ran.push(step.phase)

    // Corrió: todos sus productos duros tienen que estar.
    for (const artifact of produces) {
      if (presence(artifact) === true) continue
      if (presence(artifact) === null) continue // hecho ICM o del WORKSPACE
      findings.push(`${step.phase}: declaró producir ${artifact} y el archivo falta o está vacío`)
    }

    // Corrió, así que su entrada tenía que estar. `Phase_4_Verify` produce su
    // reporte Y requiere el contrato de la Pre-Flight: si el reporte existe y
    // el contrato no, el ciclo verificó contra nada.
    for (const artifact of requires) {
      const state = presence(artifact)
      if (state === null) continue
      if (!state) findings.push(`${step.phase}: corrió sin ${artifact}, que requiere`)
    }
  }

  return { id: task.id, feature: task.feature, findings, ran }
}

/** Las tareas que existen bajo `.tasks/<feature>/TASK-YYYY-NNN`. */
export function tasksOnDisk(root) {
  const tasksRoot = path.join(root, '.tasks')
  if (!fs.existsSync(tasksRoot)) return []

  const found = []
  for (const feature of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    const featureDir = path.join(tasksRoot, feature.name)
    for (const task of fs.readdirSync(featureDir, { withFileTypes: true })) {
      if (task.isDirectory() && /^TASK-\d{4}-\d{3}$/.test(task.name)) {
        found.push({ id: task.name, feature: feature.name })
      }
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id))
}

/** Audita todas las tareas. */
export function auditTaskArtifacts(root, chain = HANDOFFS) {
  const tasks = tasksOnDisk(root)
  const rows = tasks.map((t) => auditTask(root, t, chain))
  return {
    tasks: rows,
    findings: rows.flatMap((r) => r.findings.map((f) => `${r.feature}/${r.id} → ${f}`)),
  }
}

export function formatReport(result) {
  const lines = ['=== AOI Task Artifacts — lo que la corrida dejó ===', '']
  if (result.tasks.length === 0) {
    lines.push('Sin tareas bajo `.tasks/`: no hay corrida que auditar.')
    lines.push('Un veredicto sobre cero entradas no diría si el ciclo produce sus artefactos.')
    return lines.join('\n')
  }
  for (const row of result.tasks) {
    const ran = row.ran.length > 0 ? row.ran.join(' → ') : '(ninguna fase dejó productos)'
    lines.push(`${row.feature}/${row.id}`)
    lines.push(`  fases con productos: ${ran}`)
    for (const f of row.findings) lines.push(`  ❌ ${f}`)
  }
  lines.push('')
  lines.push(`Tareas: ${result.tasks.length} · hallazgos: ${result.findings.length}`)
  lines.push(
    result.findings.length === 0
      ? '✅ Cada fase que corrió dejó sus artefactos y tuvo su entrada.'
      : '❌ Una fase corrió sin su entrada, o dejó su producto a medias.'
  )
  return lines.join('\n')
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/sdd-lifecycle/audit-task-artifacts.mjs [--json] [--exit-code]\n' +
        '\nCompara lo que el contrato de fases declara contra lo que la corrida dejó\n' +
        'en `.tasks/`. No juzga el CONTENIDO de un artefacto: que exista y no esté\n' +
        'vacío.\n' +
        '\nExit codes (with --exit-code):\n' +
        '  0  ninguna fase corrió sin su entrada ni dejó su producto a medias,\n' +
        '     O no hay tareas que auditar (no hay corrida)\n' +
        '  1  una fase corrió con entrada faltante, o con producto incompleto\n' +
        '\nEsta entrada CLI NO está en la cadena de `pnpm test`: necesita tareas\n' +
        'reales y el ciclo no corre en este repositorio. Su TEST sí corre, como el\n' +
        'de cualquier área. Es un instrumento de verificación, como `aoi:probes`.\n'
    )
    return
  }

  const result = auditTaskArtifacts(process.cwd())
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    process.stdout.write(`${formatReport(result)}\n`)
  }
  if (args.includes('--exit-code') && result.findings.length > 0) process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
