#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/behavioral-runner.mjs
 *
 * El runner que faltaba: emite las sondas conductuales y JUZGA las respuestas.
 *
 * El defecto que cierra. `behavioral-probes.mjs` escribía 25 sondas y nadie las
 * ejecutaba nunca, así que las conductas que declaran no las comprobaba ninguna
 * corrida. El propio archivo lo admitía a medias —"responderlas cuesta
 * inferencia"— y ahí quedaba: sin un runner, una sonda es documentación con
 * formato de test.
 *
 * La pieza que faltaba era chica y no obvia: **cada sonda ya trae su criterio**.
 * `expected` y `forbidden` son regex, así que el juez es determinista y no
 * necesita un modelo. Lo único que necesita un modelo es PRODUCIR la respuesta;
 * juzgarla es aritmética, y por eso es 0 tokens.
 *
 * Uso:
 *   node scripts/sdd-lifecycle/behavioral-runner.mjs --emit [dir]
 *   node scripts/sdd-lifecycle/behavioral-runner.mjs --judge <answers.json>
 *
 * Formato de respuestas: `{ "<id-de-sonda>": "<respuesta del modelo>", ... }`.
 * Un id ausente cuenta como no respondida y FALLA: una sonda sin respuesta es
 * indistinguible de una conducta rota, y callarla es la mitad de este defecto.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { buildProbePrompt } from './behavioral-probes.mjs'
import { PROBES } from './behavioral-scenarios.mjs'

/**
 * Marcas de EVASIÓN: una respuesta que declara no poder decidir no decidió.
 *
 * El prompt de la sonda le da al agente una salida explícita —"respondé NO
 * PUEDO DETERMINARLO CON ESTE CONTEXTO"— para que no invente cuando el contexto
 * no alcanza. Está bien que exista, y por eso hay que verla: contarla como
 * aprobada sería premiar al que se rinde.
 *
 * **`\bno\s+sé\b`, con acento y sin `[eé]`, y esto es un arreglo medido.** La
 * primera versión usaba `s[eé]`, que con el flag `i` matchea también `se` — la
 * palabra castellana normal, como en *"NO **se** genere un TASK-ID"*. Tres de las
 * 25 respuestas reales de un modelo quedaron marcadas como evasión por escribir
 * una oración correcta en castellano:
 *
 *   zero-task-footprint      -> "exige que NO se genere un TASK-YYYY-NNN"
 *   missing-upstream-artifact -> "no se cumple la precondición"
 *
 * Las dos eran respuestas correctas y completas. Los 15 tests sintéticos no lo
 * vieron porque la batería usaba `"No se."` con punto —que igual cae por el piso
 * de longitud— y nunca una oración que contuviera `no se` en medio. **Lo encontró
 * correr las sondas contra un modelo de verdad**, que es la lección: una batería
 * de no-respuestas prueba lo que a uno se le ocurrió escribir.
 */
export const NON_ANSWER = /NO PUEDO DETERMINARLO|\bno\s+sé\b|^\s*no\s+puedo\b|\b(no\s+estoy\s+seguro|no\s+tengo\s+(informaci[oó]n|contexto)|sin\s+contexto)\b/i

/**
 * Piso de longitud. Cada escenario pide la decisión **y su porqué** ("en una
 * línea por qué"), así que una respuesta de una palabra no puede contener el
 * porqué. No es una regla de estilo: es que el criterio de la sonda juzga una
 * justificación, y sin justificación no hay nada que juzgar.
 *
 * Es también lo que atrapa un `"No se."` pelado, que es por lo que la marca de
 * evasión puede permitirse exigir el acento.
 */
export const MIN_ANSWER_CHARS = 12

/**
 * Un `forbidden` NEGADO no es una violación.
 *
 * El segundo defecto que encontró la corrida real, y es la misma clase que ya
 * tenía `expected`: el patrón mira texto, y el texto puede estar mencionando la
 * opción equivocada **para descartarla**. `triage-routing` prohíbe `/sdd-frame/`,
 * y una respuesta correcta —que enruta a `@triage-specialist`— escribió *"así que
 * **no va a** `/sdd-frame`"*. El juez la reprobó por nombrar lo que estaba
 * excluyendo: exactamente al revés de lo que el criterio quiere medir.
 *
 * La regla: se inspecciona lo que precede a cada coincidencia y, si hay una
 * negación a mano, esa coincidencia no cuenta. Una mención sin negar sigue
 * siendo violación.
 */
const NEGATED_BEFORE = /\b(no|ni|nunca|jamás|never|not|sin|tampoco|en vez de|instead of)\b[^.;:]{0,50}$/i

/**
 * ¿La respuesta cae en lo prohibido **de verdad**?
 *
 * @param {RegExp} forbidden
 * @param {string} text
 * @returns {string|null} la coincidencia que viola, o null
 */
export function findForbidden(forbidden, text) {
  if (!forbidden) return null
  const flags = forbidden.flags.includes('g') ? forbidden.flags : `${forbidden.flags}g`
  for (const m of String(text).matchAll(new RegExp(forbidden.source, flags))) {
    const before = String(text).slice(0, m.index)
    if (!NEGATED_BEFORE.test(before)) return m[0]
  }
  return null
}

/**
 * Juzga una respuesta contra el criterio de su sonda.
 *
 * El orden importa: primero se descarta la evasión y el mutismo, y sólo después
 * se aplica el criterio. Al revés, una evasión que por casualidad contenga una
 * palabra del criterio pasaría — que es exactamente lo que pasaba con las dos
 * sondas cuyo `expected` incluía `\bno\b`.
 *
 * @returns {{ id: string, verdict: 'pass'|'fail', reason: string }}
 */
export function judgeAnswer(probe, answer) {
  if (typeof answer !== 'string' || answer.trim() === '') {
    return { id: probe.id, verdict: 'fail', reason: 'sin respuesta' }
  }
  const text = answer.trim()
  if (NON_ANSWER.test(text)) {
    return { id: probe.id, verdict: 'fail', reason: 'evasión: declara no poder decidir' }
  }
  if (text.length < MIN_ANSWER_CHARS) {
    return { id: probe.id, verdict: 'fail', reason: `respuesta de ${text.length} caracteres: no puede llevar el porqué` }
  }
  if (!probe.expected.test(text)) {
    return { id: probe.id, verdict: 'fail', reason: `no cumple /${probe.expected.source}/` }
  }
  const violacion = findForbidden(probe.forbidden, text)
  if (violacion) {
    return { id: probe.id, verdict: 'fail', reason: `menciona sin negar lo prohibido: "${violacion}"` }
  }
  return { id: probe.id, verdict: 'pass', reason: 'ok' }
}

/**
 * Juzga el lote completo. Un id presente en las respuestas pero ausente de las
 * sondas también falla: es la firma de un archivo de respuestas de otra versión,
 * y aceptarlo en silencio haría pasar la corrida sobre sondas que ya no existen.
 *
 * Sólo objetos planos: un `Map` habría dejado `Object.keys` vacío y el chequeo
 * de ids desconocidos —la mitad del valor de este paso— pasaría por no mirar.
 *
 * @returns {{ results: Array<object>, passed: number, failed: number, unknown: string[] }}
 */
export function judgeAll(answers, probes = PROBES) {
  const map = answers && typeof answers === 'object' ? answers : {}
  const results = probes.map((p) => judgeAnswer(p, map[p.id]))
  const known = new Set(probes.map((p) => p.id))
  const unknown = Object.keys(map).filter((k) => !known.has(k)).sort()
  const passed = results.filter((r) => r.verdict === 'pass').length
  return { results, passed, failed: results.length - passed, unknown }
}

/** Escribe una sonda por archivo, más un índice. Devuelve las rutas escritas. */
export function emitProbes(root, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const written = []
  for (const probe of PROBES) {
    const file = path.join(outDir, `${probe.id}.txt`)
    fs.writeFileSync(file, buildProbePrompt(root, probe))
    written.push({ id: probe.id, phase: probe.phase, file })
  }
  // El índice hace que la corrida sea auditable: sin él hay que adivinar qué
  // sondas existían cuando se respondieron.
  fs.writeFileSync(
    path.join(outDir, 'index.json'),
    JSON.stringify(PROBES.map((p) => ({ id: p.id, phase: p.phase, prompt: p.prompt })), null, 2) + '\n'
  )
  return written
}

/**
 * Reporte legible. Devuelve el código de salida.
 *
 * El pie de alcance NO es decorativo. `expected` está sobrecargado a propósito
 * —tiene que aparecer en el contexto de la fase Y describir una respuesta— y esa
 * doble obligación lo vuelve una condición NECESARIA, no suficiente: que la
 * respuesta contenga el patrón no prueba que el modelo haya decidido bien, sólo
 * que no decidió mal de la forma que el patrón sabe detectar. Reportar "25/25"
 * sin decirlo es exactamente el verde que sobreafirma que este repositorio
 * persigue.
 */
export function formatRunReport({ results, passed, failed, unknown }) {
  const lines = [
    '=== Juicio de sondas conductuales ===',
    `  ${passed}/${results.length} correctas`,
  ]
  for (const r of results.filter((x) => x.verdict === 'fail')) {
    lines.push(`  ❌ ${r.id.padEnd(28)} ${r.reason}`)
  }
  if (unknown.length > 0) {
    lines.push(`  ⚠️  ids en el archivo de respuestas que no son sondas: ${unknown.join(', ')}`)
  }
  lines.push(
    '',
    'ALCANCE — qué prueba y qué no:',
    '  · SÍ: cada respuesta no es una evasión, lleva el porqué, y contiene el',
    '    patrón que la fase también contiene.',
    '  · NO: que el modelo haya USADO la evidencia del contexto. El patrón es la',
    '    condición necesaria que se puede chequear sin inferencia; la suficiente',
    '    necesita un juez humano o adversarial.',
    '  · Un `pass` acota el espacio de respuestas incorrectas. No lo cierra.'
  )
  return { text: lines.join('\n'), code: failed > 0 || unknown.length > 0 ? 1 : 0 }
}

/* c8 ignore start -- envoltura de CLI */
function main() {
  const args = process.argv.slice(2)
  const i = args.findIndex((a) => a === '--emit' || a === '--judge')

  if (i === -1) {
    process.stderr.write(
      'Uso:\n' +
        '  node scripts/sdd-lifecycle/behavioral-runner.mjs --emit [dir]\n' +
        '  node scripts/sdd-lifecycle/behavioral-runner.mjs --judge <answers.json>\n' +
        '\n--emit escribe los prompts listos para alimentar un modelo (0 tokens).\n' +
        '--judge compara las respuestas contra expected/forbidden (0 tokens).\n' +
        'Lo único que cuesta inferencia es PRODUCIR las respuestas.\n'
    )
    process.exit(2)
  }

  if (args[i] === '--emit') {
    const outDir = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '/tmp/aoi-probes'
    const written = emitProbes(process.cwd(), outDir)
    for (const w of written) console.log(`${w.id.padEnd(28)} ${w.phase.padEnd(16)} -> ${w.file}`)
    console.log(`\n${written.length} sondas y su index.json escritas en ${outDir}`)
    process.exit(0)
  }

  const answersFile = args[i + 1]
  if (!answersFile || !fs.existsSync(answersFile)) {
    process.stderr.write(`Error: no existe el archivo de respuestas: ${answersFile ?? '(sin ruta)'}\n`)
    process.exit(2)
  }
  const report = formatRunReport(judgeAll(JSON.parse(fs.readFileSync(answersFile, 'utf8'))))
  process.stdout.write(report.text + '\n')
  process.exit(report.code)
}
/* c8 ignore stop */

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
