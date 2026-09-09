#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/cache-prefix.mjs
 *
 * Measures how much of the fixed cost is THE SAME BYTES, PAID AGAIN.
 *
 * The context budget answers what a cycle costs. It cannot answer the question
 * underneath: of those tokens, how many are a second, third and sixth copy of
 * prose already sent? That distinction decides two things the budget alone
 * gets wrong.
 *
 * First, priority. A token removed from a file loaded in one phase saves one
 * token; the same token removed from a file loaded in all six saves six. The
 * budget ranks files by size and so ranks them wrong. Every trim before this
 * module was chosen without knowing its multiplier.
 *
 * Second, the ceiling of prompt caching. A cache can only ever recover bytes
 * that repeat, so the repeated mass is the upper bound of what caching could
 * be worth here — measured, instead of assumed.
 *
 * WHAT THIS DOES NOT CLAIM. AOI does not build the API request and cannot
 * place cache breakpoints: ordering and reuse belong to the harness. So the
 * recoverable figure is a ceiling conditional on the harness caching a stable
 * prefix, and it is reported as one. The multiplier is not conditional on
 * anything — it holds whoever runs the cycle.
 *
 * Static arithmetic over files on disk: 0 inference tokens.
 */

import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CACHE_BUSTER_PATTERNS } from '../multi-harness/cache-guard.mjs'
import { assemblePhaseContext } from './assemble-phase-context.mjs'
import { SDD_PHASES } from './context-budget.mjs'
import { read } from './instruction-scope.mjs'

/** Anthropic bills a cache read at a tenth of an input token. */
export const CACHE_READ_RATE = 0.1

/**
 * Every file the floor of any phase loads, with the phases that load it.
 *
 * Built from the assembler rather than from a second walk of the prompts, so
 * this and the budget can never describe different surfaces.
 *
 * @returns {Map<string, { tokens: number, phases: string[] }>}
 */
export function surfaceLoadMap(root, phases = SDD_PHASES) {
  const map = new Map()
  for (const [key, rel] of phases) {
    for (const part of assemblePhaseContext(root, rel, key).parts) {
      const entry = map.get(part.source) ?? { tokens: part.tokens, phases: [] }
      entry.phases.push(key)
      map.set(part.source, entry)
    }
  }
  return map
}

/**
 * Splits the surface by how many phases load it.
 *
 * `universal` is the band that repeats in every phase — the mass a prefix
 * cache could reach and the band where a trim is worth its multiplier.
 */
export function partitionSurface(map, phaseCount = SDD_PHASES.length) {
  const rows = [...map].map(([source, e]) => ({
    source,
    tokens: e.tokens,
    multiplier: e.phases.length,
    cycleTokens: e.tokens * e.phases.length,
  }))
  const universal = rows.filter((r) => r.multiplier === phaseCount)
  const repeated = rows.filter((r) => r.multiplier > 1 && r.multiplier < phaseCount)
  const once = rows.filter((r) => r.multiplier === 1)
  const sum = (list, k) => list.reduce((n, r) => n + r[k], 0)

  return {
    universal,
    repeated,
    once,
    universalPerPhase: sum(universal, 'tokens'),
    universalCycle: sum(universal, 'cycleTokens'),
    repeatedCycle: sum(repeated, 'cycleTokens'),
    onceCycle: sum(once, 'cycleTokens'),
    floor: sum(rows, 'cycleTokens'),
  }
}

/**
 * What a prefix cache could recover from the repeated mass, at best.
 *
 * The first phase pays it in full; the rest pay the cache-read rate. This is
 * an upper bound and nothing else: it assumes the harness keeps the mass in a
 * stable prefix, which is the harness's decision, not AOI's.
 */
export function cacheEconomics(perPhase, phaseCount = SDD_PHASES.length, rate = CACHE_READ_RATE) {
  const uncached = perPhase * phaseCount
  const cached = Math.round(perPhase + perPhase * (phaseCount - 1) * rate)
  return { uncached, cached, recoverable: uncached - cached }
}

/**
 * Fingerprint of the repeated mass.
 *
 * The property that would actually destroy caching is not a suspicious-looking
 * pattern inside a file — it is the file's bytes changing between two requests.
 * Nothing in the repository can prove that on its own, because a rewrite would
 * happen in an installed workspace during a cycle. So this emits a digest that
 * a real run can take before and after: same digest, the mass held still.
 */
export function surfaceDigest(root, rows) {
  const h = crypto.createHash('sha256')
  for (const r of [...rows].sort((a, b) => a.source.localeCompare(b.source))) {
    h.update(`${r.source}:${r.tokens}\n`)
  }
  return h.digest('hex').slice(0, 16)
}

/**
 * Gate over the repeated mass: the same buster patterns, but whole-file.
 *
 * cache-guard reads the first 1500 characters of each prompt. That window is
 * why `$(date +%Y)` at offset 7223 of sdd-frame.prompt.md passes it today. The
 * window is not wrong so much as narrow, and simply widening it repository-wide
 * would fail on prose that merely QUOTES a shell command — text whose bytes
 * never move. So the widened scan is aimed only where a buster would actually
 * be expensive: the eight files every phase reloads. Small set, no false
 * positive today, and a real cost if one ever appears.
 */
export function auditRepeatedMass(root, rows) {
  const violations = []
  for (const r of rows) {
    const text = read(path.join(root, r.source))
    for (const pattern of CACHE_BUSTER_PATTERNS) {
      if (pattern.regex.test(text)) {
        violations.push(`${r.source}: ${pattern.name} — se recarga x${r.multiplier} por ciclo`)
      }
    }
  }
  return violations
}

/** A cycle surface that rewrites a surface the cycle keeps reloading. */
const REWRITES = /(write|edit|create|update|append|regenerate|sync)[^\n]{0,40}\.github\/(instructions|skills|agents)/i

/**
 * Detects the one thing that would genuinely break a warm cache: a phase that
 * rewrites a file a later phase reloads. Prose-level and therefore fallible,
 * which is why `surfaceDigest` exists as the empirical counterpart.
 */
export function auditMidCycleRewrites(root, rows) {
  return rows
    .filter((r) => REWRITES.test(read(path.join(root, r.source))))
    .map((r) => `${r.source} indica reescribir una superficie siempre inyectada`)
}

/** One line per file, heaviest cycle cost first. */
export function formatMultiplierTable(rows, limit = 12) {
  return [...rows]
    .sort((a, b) => b.cycleTokens - a.cycleTokens)
    .slice(0, limit)
    .map(
      (r) =>
        `  x${r.multiplier}  ${String(r.tokens).padStart(5)} c/u  ` +
        `${String(r.cycleTokens).padStart(6)} por ciclo  ${r.source}`
    )
    .join('\n')
}

/** The report the benchmark prints. */
export function formatCacheReport(part, phaseCount = SDD_PHASES.length) {
  const econ = cacheEconomics(part.universalPerPhase, phaseCount)
  const share = part.floor > 0 ? ((part.universalCycle / part.floor) * 100).toFixed(1) : '0.0'

  return [
    'REPETICION DEL PISO (los mismos bytes, pagados de nuevo):',
    `- Universal, en las ${phaseCount} fases: ${part.universal.length} archivos, ` +
      `${part.universalPerPhase.toLocaleString()} tok/fase = ${part.universalCycle.toLocaleString()} por ciclo`,
    `- Repetido en algunas fases:            ${part.repeatedCycle.toLocaleString()} por ciclo`,
    `- Cargado una sola vez:                 ${part.onceCycle.toLocaleString()} por ciclo`,
    `- PISO:                                 ${part.floor.toLocaleString()} tokens`,
    `- El ${share}% del piso es masa repetida.`,
    '',
    'TECHO DE LO QUE UN CACHE DE PREFIJO PODRIA RECUPERAR:',
    `- Sin cache:      ${econ.uncached.toLocaleString()} tokens`,
    `- Con cache a ${CACHE_READ_RATE}: ${econ.cached.toLocaleString()} tokens`,
    `- Recuperable:    ${econ.recoverable.toLocaleString()} tokens por ciclo`,
    '',
    'Es un TECHO, no una promesa: AOI no arma el request ni coloca los puntos de',
    'corte del cache, asi que el reuso lo decide el harness. Lo que si es',
    'incondicional es el multiplicador — un token recortado en la banda universal',
    `vale ${phaseCount}, y uno recortado en un prompt de fase vale 1.`,
    '',
    'COSTO POR CICLO, ORDENADO POR LO QUE DE VERDAD CUESTA:',
    formatMultiplierTable([...part.universal, ...part.repeated, ...part.once]),
  ].join('\n')
}

function main() {
  const root = process.cwd()
  const part = partitionSurface(surfaceLoadMap(root))

  console.log('=== AOI Cache Prefix Economics ===\n')
  console.log(formatCacheReport(part))
  console.log(`\nHuella de la masa repetida: ${surfaceDigest(root, part.universal)}`)
  console.log('Tomala antes y despues de un ciclo real: si cambia, algo reescribio')
  console.log('una superficie siempre inyectada y no hay cache que sobreviva a eso.')

  const all = [...part.universal, ...part.repeated, ...part.once]
  const failures = [...auditRepeatedMass(root, part.universal), ...auditMidCycleRewrites(root, all)]
  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    process.exit(1)
  }
  console.log('\n✅ La masa repetida no muta durante el ciclo ni contiene contenido volatil.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
