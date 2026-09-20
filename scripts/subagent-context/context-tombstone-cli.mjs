#!/usr/bin/env node
/**
 * scripts/subagent-context/context-tombstone-cli.mjs
 *
 * La superficie de línea de comandos del tombstoning.
 *
 * Separado de `context-tombstone.mjs` cuando tener las dos cosas en un archivo
 * lo dejó en 300 LOC exactas — el límite del Invariante 5, con margen cero —.
 * La costura es real y es la que este repositorio ya usó tres veces
 * (`instruction-scope.mjs`, `sync-paths.mjs`, `stress-report.mjs`): **qué hace
 * el algoritmo** y **cómo lo invoca un shell** son dos preguntas distintas.
 *
 * El algoritmo no se toca: `context-tombstone.mjs` queda intacto en sus 144 LOC
 * y este archivo lo consume. El emparejamiento usa `isTurnSuperseded`, la MISMA
 * función que usa `shrinkTurns`, así que no hay una segunda regla que pueda
 * divergir de la primera.
 *
 * Aritmética de filesystem y strings: 0 tokens de inferencia.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildTombstoneIcmRecord,
  isTurnSuperseded,
  shrinkTurns,
} from './context-tombstone.mjs'
// El estimador es el ÚNICO del repositorio: un `Math.round(len / 4)` local lo
// duplicaría y las dos cifras podrían discrepar sin que nada lo diga.
import { estimateTokens } from '../sdd-lifecycle/token-accounting.mjs'

/**
 * Los pares (turno tumbado, turno que lo tumba).
 *
 * Se derivan acá en vez de cambiarle la firma a `shrinkTurns`, que ya tiene
 * consumidor (el stress-suite la importa). No es una segunda regla: es otra
 * llamada a la misma.
 */
export function supersededPairs(turns) {
  const pairs = []
  for (let i = 0; i < turns.length; i++) {
    for (let j = i + 1; j < turns.length; j++) {
      if (isTurnSuperseded(turns[i], turns[j])) {
        pairs.push({ superseded: turns[i], resolution: turns[j] })
        break
      }
    }
  }
  return pairs
}

/**
 * Corre el tombstoning sobre un archivo de turnos.
 *
 * Puro salvo por leer el path que recibe: no toca `process.argv` ni decide el
 * veredicto. Esa separación es lo que permite ejercitar cada rama con una
 * entrada, en vez de matando un subproceso.
 *
 * @param {{ file: string, threshold?: number }} opts
 * @returns {{ applied: boolean, reason?: string, turns: number, tombstoned: number,
 *   tokensBefore: number, tokensAfter: number, icm: Array<object>, result: Array<object> }}
 */
export function runTombstone(opts) {
  const raw = JSON.parse(fs.readFileSync(opts.file, 'utf8'))
  const turns = Array.isArray(raw) ? raw : raw?.turns
  if (!Array.isArray(turns)) {
    throw new Error(`${opts.file}: se esperaba un array de turnos, o un objeto con "turns"`)
  }

  const threshold = opts.threshold ?? 0
  const tokensBefore = turns.reduce((n, t) => n + estimateTokens(t?.content ?? ''), 0)

  // El umbral se REPORTA cuando frena. Un CLI que devuelve el archivo sin decir
  // por qué deja al operador sin saber si corrió o si decidió no hacer nada.
  if (turns.length <= threshold) {
    return {
      applied: false,
      reason: `${turns.length} turno(s) <= --threshold ${threshold}: no se toca nada`,
      turns: turns.length,
      tombstoned: 0,
      tokensBefore,
      tokensAfter: tokensBefore,
      icm: [],
      result: turns,
    }
  }

  const result = shrinkTurns(turns)
  return {
    applied: true,
    turns: turns.length,
    tombstoned: result.filter((t) => t.isTombstone).length,
    tokensBefore,
    tokensAfter: result.reduce((n, t) => n + estimateTokens(t?.content ?? ''), 0),
    icm: supersededPairs(turns)
      .map((p) => buildTombstoneIcmRecord(p.superseded, p.resolution))
      .filter(Boolean),
    result,
  }
}

/** El reporte. Separado de `runTombstone` para poder testearlo sin disco. */
export function formatTombstoneReport(r, { dryRun = false } = {}) {
  const saved = r.tokensBefore - r.tokensAfter
  const pct = r.tokensBefore > 0 ? ((saved / r.tokensBefore) * 100).toFixed(1) : '0.0'
  const lines = [
    '=== AOI Context Tombstone ===',
    '',
    `Turnos:         ${r.turns}`,
    `Tumbados:       ${r.tombstoned}`,
    `Tokens antes:   ${r.tokensBefore}`,
    `Tokens despues: ${r.tokensAfter}`,
    `Ahorro:         ${saved} (${pct}%)`,
  ]
  if (r.icm.length > 0) {
    lines.push('', `Errores resueltos a persistir en ICM: ${r.icm.length}`)
    for (const rec of r.icm) lines.push(`  [${rec.topic}] ${rec.content}`)
  }
  if (!r.applied) lines.push('', `No se aplico: ${r.reason}`)
  else if (dryRun) lines.push('', 'Dry run: no se escribio nada.')
  return lines.join('\n')
}

function usage() {
  process.stdout.write(
    'Usage: node scripts/subagent-context/context-tombstone-cli.mjs --file <turns.json> ' +
      '[--threshold <n>] [--output <path>] [--dry-run]\n' +
      '\nReemplaza tool-outputs superados por tumbas de una linea: resuelve el\n' +
      'crecimiento cuadratico del contexto (O(N^2) -> O(N)) y exporta los errores\n' +
      'resueltos como registros para ICM. Entrada: un array de turnos, o un objeto\n' +
      'con la clave "turns"; cada turno lleva `tool`, opcionalmente `target`,\n' +
      '`turnNumber`, `summary`, `content` y `error`.\n' +
      '\n--threshold <n>  no toca nada si hay n turnos o menos\n' +
      '--dry-run        reporta sin escribir\n' +
      '--output <path>  destino de los turnos procesados (default: stdout)\n' +
      '\nExit codes:\n' +
      '  0  corrio (haya aplicado o no), o se pidio la ayuda\n' +
      '  1  no se pudo leer el archivo, o su forma no es la esperada\n'
  )
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) return usage()

  const value = (flag) => {
    const i = args.indexOf(flag)
    if (i < 0) return undefined
    const next = args[i + 1]
    // Un flag seguido de otro flag, o al final, no tiene valor: devolver
    // `undefined` deja decidir al default, en vez de tomar el flag como un path.
    return next === undefined || next.startsWith('--') ? undefined : next
  }

  const file = value('--file')
  if (!file) {
    process.stderr.write('Falta --file <turns.json>. Usá --help.\n')
    process.exit(1)
  }

  const dryRun = args.includes('--dry-run')
  const output = value('--output')
  const rawThreshold = value('--threshold')

  let report
  try {
    report = runTombstone({ file, threshold: rawThreshold === undefined ? 0 : Number(rawThreshold) })
  } catch (err) {
    process.stderr.write(`[context-tombstone] ${err.message}\n`)
    process.exit(1)
  }

  process.stdout.write(`${formatTombstoneReport(report, { dryRun })}\n`)

  if (report.applied && !dryRun) {
    const body = `${JSON.stringify(report.result, null, 2)}\n`
    // Con --output se escribe ahí; sin él los turnos van a stdout después del
    // reporte: el reporte es lo que se lee y el flujo lo que se redirige.
    if (output) fs.writeFileSync(output, body)
    else process.stdout.write(`\n${body}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
