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
 * ¿ICM contestó que no tiene NADA para esta entidad?
 *
 * `icm` no usa códigos de salida: una entidad inexistente devuelve `no facts
 * for <entity>` en stdout **con exit 0**, indistinguible de una consulta exitosa
 * si uno sólo mira el código. La única señal es este texto.
 */
export function noFacts(text) {
  return /^no facts for /im.test(String(text))
}

/** Una invocación cruda a `icm facts list`, sin interpretar el resultado. */
function listFacts(entity, prefix) {
  const args = ['facts', 'list', entity]
  if (prefix) args.push('-p', prefix)
  args.push('--read-only')
  return execFileSync('icm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/**
 * Reads the fact table for an entity via the `icm` CLI.
 *
 * Never throws: a broken toolchain is a RESULT the caller has to block on, not
 * an exception to swallow. `reason` exists so exit 2 can say which failure
 * happened.
 *
 * **Distingue "sin contrato" de "entidad desconocida", y esa distinción es un
 * arreglo, no un detalle.** Medido: `--entity "ENTIDAD-QUE-NO-EXISTE" --exit-code`
 * salía **0** reportando `SKIPPED`. O sea que un nombre mal escrito —o un
 * workspace que nunca corrió `/init`— pasaba como "no hay contrato que
 * incumplir": un falso verde en el gate que existe para cazar falsos verdes.
 *
 * El `SKIPPED` documentado sigue siendo válido donde corresponde: una entidad
 * que ICM CONOCE pero sin hechos `bic.*` es un workspace real que no pasó por
 * `/sdd-frame`. Ésa no tiene nada que exigir y sale 0. Una entidad que ICM no
 * conoce no es un contrato vacío: es una consulta que no encontró su objeto.
 *
 * @param {string} entity
 * @returns {{ ok: boolean, text: string, reason?: string }}
 */
export function readFactsFromIcm(entity) {
  try {
    const text = listFacts(entity, 'bic.')
    if (noFacts(text)) {
      // Sin hechos bic.*: ¿la entidad existe y simplemente no tiene contrato,
      // o no existe? La consulta SIN prefijo lo decide — es la única forma de
      // preguntarle a ICM si conoce la entidad.
      let all = ''
      try {
        all = listFacts(entity, '')
      } catch {
        all = ''
      }
      if (noFacts(all) || all.trim() === '') {
        return {
          ok: false,
          text: '',
          reason:
            `ICM no conoce la entidad "${entity}": no tiene ningún hecho. ` +
            'O el nombre está mal escrito, o el workspace nunca corrió /init',
        }
      }
    }
    return { ok: true, text }
  } catch (err) {
    const reason =
      err?.code === 'ENOENT'
        ? 'the `icm` binary is not on PATH'
        : `icm exited with an error (${err?.message || 'unknown'})`
    return { ok: false, text: '', reason }
  }
}
