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

// Re-exportado: el juez se movió a su propio módulo cuando este archivo cruzó las
// 300 LOC, pero es parte de su superficie pública y los llamadores no deberían
// tener que enterarse de dónde cayó el corte.
export { judgeAnswer, judgeAll, findForbidden, declaredDecision, NON_ANSWER, DECISION_LINE, MOTIVO_LINE, SHORT_PROBES, MIN_ANSWER_CHARS, MIN_SHORT_CHARS, NO_NEGAN } from './behavioral-judge.mjs'
import { judgeAll } from './behavioral-judge.mjs'

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
