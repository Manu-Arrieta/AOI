/**
 * scripts/sdd-lifecycle/contract-facts.mjs
 *
 * Consigue el contrato y lo convierte en reglas. Nada más.
 *
 * Split de `invariant-gate.mjs` cuando ese archivo cruzó las 300 LOC del
 * Invariante 5 al ganar la resolución automática de entidad. El límite tenía
 * razón y el corte es un límite de verdad: **leer y parsear el contrato** es
 * una pregunta distinta de **cruzarlo contra la suite**. La primera habla con
 * `icm` y con el formato de su tabla; la segunda no sabe de dónde vinieron los
 * hechos.
 *
 * Mismo precedente que `test-reachability.mjs`: el gate re-exporta lo que era
 * su superficie pública, así que ningún llamador tuvo que enterarse del corte.
 */

import { execFileSync } from 'node:child_process'

/** Fact key shapes written by /sdd-frame on Intent Gate approval. */
export const NEVER_KEY_PATTERN = /^bic\.([A-Za-z0-9_-]+)\.never\.(\d+)$/
export const ORACLE_KEY_PATTERN = /^bic\.([A-Za-z0-9_-]+)\.oracle$/

/**
 * Parses the two-column table emitted by `icm facts list <entity>`.
 * @param {string} text
 * @returns {Array<{ key: string, value: string }>}
 */
export function parseFactTable(text = '') {
  const facts = []
  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue
    if (/^-{3,}$/.test(line.trim())) continue
    if (/^key\s+value$/i.test(line.trim())) continue

    const match = line.match(/^(\S+)\s{2,}(.*)$/)
    if (!match) continue

    const key = match[1].trim()
    const value = match[2].trim()
    if (key) facts.push({ key, value })
  }
  return facts
}

/**
 * Extracts BIC contract rules (Never Rules + Business Oracles) from ICM facts.
 * @param {Array<{ key: string, value: string }>} facts
 * @param {string} [bicFilter] Optional BIC id to narrow the audit.
 * @returns {Array<{ bicId: string, kind: 'never'|'oracle', tag: string, statement: string }>}
 */
export function extractContractRules(facts = [], bicFilter = '') {
  const rules = []

  for (const fact of facts) {
    if (!fact || typeof fact.key !== 'string') continue

    const never = fact.key.match(NEVER_KEY_PATTERN)
    if (never) {
      rules.push({
        bicId: never[1],
        kind: 'never',
        tag: `${never[1]}:never.${never[2]}`,
        statement: String(fact.value || '').trim(),
      })
      continue
    }

    const oracle = fact.key.match(ORACLE_KEY_PATTERN)
    if (oracle) {
      rules.push({
        bicId: oracle[1],
        kind: 'oracle',
        tag: `${oracle[1]}:oracle`,
        statement: String(fact.value || '').trim(),
      })
    }
  }

  const filtered = bicFilter ? rules.filter((r) => r.bicId === bicFilter) : rules
  return filtered.sort((a, b) => a.tag.localeCompare(b.tag))
}

/**
 * Reads the fact table for an entity via the `icm` CLI.
 *
 * Never throws: a broken toolchain is a RESULT the caller has to block on, not
 * an exception to swallow. `reason` exists so exit 2 can say which of the two
 * failures happened — `icm` missing from PATH or `icm` erroring.
 *
 * @param {string} entity
 * @returns {{ ok: boolean, text: string, reason?: string }}
 */
export function readFactsFromIcm(entity) {
  try {
    const text = execFileSync('icm', ['facts', 'list', entity, '-p', 'bic.', '--read-only'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return { ok: true, text }
  } catch (err) {
    const reason =
      err?.code === 'ENOENT'
        ? 'the `icm` binary is not on PATH'
        : `icm exited with an error (${err?.message || 'unknown'})`
    return { ok: false, text: '', reason }
  }
}
