#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/behavioral-probes.mjs
 *
 * The decisions that prose-trimming could silently break, written down.
 *
 * Every other gate in this repository is structural: it proves a file exists,
 * a reference resolves, a table still has a row. None of them can answer the
 * only question that matters after removing prose — does an agent still decide
 * correctly with what is left?
 *
 * Each probe pins one decision to the cut that could have broken it. A probe
 * is not "is the text still there": it is a scenario with a single defensible
 * answer, asked against the context a phase actually assembles. That context
 * comes from assemble-phase-context.mjs, whose token count is cross-checked
 * against the budget's floor, so the eval runs on exactly what ships.
 *
 * Generating the probes costs zero inference. Answering them does not, which
 * is why they are few and each one is load-bearing.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assemblePhaseContext } from './assemble-phase-context.mjs'
import { PROBES } from './behavioral-scenarios.mjs'

export { PROBES } from './behavioral-scenarios.mjs'

/** Builds the full prompt for one probe: real phase context plus the scenario. */
export function buildProbePrompt(root, probe) {
  const { text } = assemblePhaseContext(root, probe.prompt, probe.phase)
  return [
    'Sos un agente de AOI operando con EXACTAMENTE el contexto de abajo, que es el que el',
    'harness carga en esta fase. No uses conocimiento externo sobre AOI: si el contexto no',
    'alcanza para decidir, respondé "NO PUEDO DETERMINARLO CON ESTE CONTEXTO".',
    '',
    '--- INICIO DEL CONTEXTO DE LA FASE ---',
    text,
    '--- FIN DEL CONTEXTO DE LA FASE ---',
    '',
    `PREGUNTA: ${probe.scenario}`,
  ].join('\n')
}

function main() {
  const root = process.cwd()
  const outDir = process.argv[2] || '/tmp/aoi-probes'
  fs.mkdirSync(outDir, { recursive: true })
  for (const probe of PROBES) {
    const file = path.join(outDir, `${probe.id}.txt`)
    fs.writeFileSync(file, buildProbePrompt(root, probe))
    console.log(`${probe.id.padEnd(26)} ${probe.phase.padEnd(16)} -> ${file}`)
  }
  console.log(`\n${PROBES.length} sondas escritas en ${outDir}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
