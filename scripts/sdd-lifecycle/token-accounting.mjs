/**
 * scripts/sdd-lifecycle/token-accounting.mjs
 *
 * Token measurement primitives for the SDD lifecycle benchmark.
 *
 * The point of this module is PROVENANCE. A benchmark that prints a fabricated
 * constant in the same table as a real measurement teaches you to trust both
 * equally, which is worse than printing nothing. Every recorded phase must
 * declare how its numbers were obtained, and the report surfaces that verdict.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/** Both sides read from real artifacts or real tool output. */
export const MEASURED = 'measured'
/** Real algorithm, synthetic input — the mechanism is exercised, the volume is not real. */
export const FIXTURE = 'fixture'
/** Could not be measured in this environment; contributes nothing to the totals. */
export const SKIPPED = 'skipped'

/** Shared estimator: ~4 characters per token. */
export function estimateTokens(text) {
  return Math.round(String(text ?? '').length / 4)
}

/**
 * Runs a command and captures stdout, never throwing.
 * @returns {{ ok: boolean, stdout: string }}
 */
export function tryCommand(bin, args = []) {
  try {
    return {
      ok: true,
      stdout: execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    }
  } catch {
    return { ok: false, stdout: '' }
  }
}

/**
 * Finds the most complete real task directory in the workspace, so phases can
 * measure genuine artifacts instead of inline fixtures.
 *
 * @param {string} root
 * @returns {string|null} path to a task dir containing spec.md, design.md and tasks.md
 */
export function findRealTaskDir(root = process.cwd()) {
  const tasksRoot = path.join(root, '.tasks')
  if (!fs.existsSync(tasksRoot)) return null

  const candidates = []
  for (const feature of fs.readdirSync(tasksRoot, { withFileTypes: true })) {
    if (!feature.isDirectory()) continue
    const featureDir = path.join(tasksRoot, feature.name)
    for (const task of fs.readdirSync(featureDir, { withFileTypes: true })) {
      if (!task.isDirectory()) continue
      const dir = path.join(featureDir, task.name)
      const complete = ['spec.md', 'design.md', 'tasks.md'].every((f) =>
        fs.existsSync(path.join(dir, f))
      )
      if (complete) candidates.push(dir)
    }
  }
  return candidates.sort().pop() || null
}

/** Reads a file, returning '' when absent. */
export function readIfPresent(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Creates a ledger that accumulates per-phase token accounting. */
export function createLedger() {
  return {
    phases: {},
    totals: { rawTokens: 0, optimizedTokens: 0, savedTokens: 0 },

    /**
     * @param {string} key Stable phase key.
     * @param {string} name Human-readable phase name.
     * @param {{ raw: number, opt: number, provenance: string, details?: string, source?: string }} m
     */
    record(key, name, { raw, opt, provenance, details = '', source = '' }) {
      if (provenance === SKIPPED) {
        this.phases[key] = { name, provenance, details, source, rawTokens: 0, optimizedTokens: 0, savedTokens: 0, percentSaved: 'n/a' }
        return this.phases[key]
      }
      const saved = Math.max(0, raw - opt)
      const pct = raw > 0 ? `${((saved / raw) * 100).toFixed(1)}%` : '0.0%'
      this.phases[key] = {
        name, provenance, details, source,
        rawTokens: raw, optimizedTokens: opt, savedTokens: saved, percentSaved: pct,
      }
      this.totals.rawTokens += raw
      this.totals.optimizedTokens += opt
      this.totals.savedTokens += saved
      return this.phases[key]
    },
  }
}

/** Counts phases by provenance. */
export function provenanceBreakdown(ledger) {
  const counts = { [MEASURED]: 0, [FIXTURE]: 0, [SKIPPED]: 0 }
  for (const p of Object.values(ledger.phases)) counts[p.provenance] = (counts[p.provenance] || 0) + 1
  return counts
}

const BADGE = { [MEASURED]: '● real', [FIXTURE]: '○ fixture', [SKIPPED]: '– skipped' }

/** Renders the ledger as rows suitable for console.table. */
export function toTableRows(ledger) {
  return Object.entries(ledger.phases).map(([key, p]) => ({
    Fase: key,
    Nombre: p.name,
    Origen: BADGE[p.provenance] || p.provenance,
    'Tokens Base': p.rawTokens,
    'Tokens AOI': p.optimizedTokens,
    'Ahorro': p.savedTokens,
    '% Reducción': p.percentSaved,
  }))
}

/** Renders the totals block, including an explicit fidelity verdict. */
export function formatTotals(ledger) {
  const { rawTokens, optimizedTokens, savedTokens } = ledger.totals
  const pct = rawTokens > 0 ? ((savedTokens / rawTokens) * 100).toFixed(1) : '0.0'
  const counts = provenanceBreakdown(ledger)
  const lines = [
    'TOTAL ACUMULADO POR CICLO SDD COMPLETO:',
    `- Consumo Base Estimado:     ${rawTokens.toLocaleString()} tokens`,
    `- Consumo AOI:               ${optimizedTokens.toLocaleString()} tokens`,
    `- AHORRO TOTAL:              ${savedTokens.toLocaleString()} tokens (${pct}% de reducción neta)`,
    '',
    `Fidelidad: ${counts[MEASURED]} fase(s) medidas sobre artefactos reales · ` +
      `${counts[FIXTURE]} sobre fixtures · ${counts[SKIPPED]} omitidas.`,
  ]
  if (counts[FIXTURE] > 0) {
    lines.push('Las fases marcadas "fixture" ejercitan el mecanismo real con entrada sintética:')
    lines.push('su porcentaje es representativo, su volumen absoluto no.')
  }
  return lines.join('\n')
}
