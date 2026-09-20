/**
 * scripts/sdd-lifecycle/invariant-gate.mjs
 *
 * Deterministic Invariant Gate for the Behavioral Intent Contract (BIC).
 * Cross-references the "Never Rules" and the Business Oracle persisted as O(1)
 * ICM facts during /sdd-frame against the project's test suite, and FAILS
 * verification when a declared business invariant has no test asserting it.
 *
 * Replaces an LLM conformance evaluator with a mechanical tag match:
 * consumes zero LLM inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { collectTestSources, dropAoiOwnedTests, dropUnreachableTests } from './test-reachability.mjs'
import { acquireRules } from './invariant-gate-preconditions.mjs'

// Re-exported: collecting test sources moved to test-reachability.mjs when this
// file crossed 300 LOC, but it is part of this module's public surface and
// callers should not have to know where the split landed.
export { collectTestSources } from './test-reachability.mjs'

// Re-exported for the same reason, when the entity-resolution work pushed this
// file over the line again: reading and parsing the contract is a different
// question from crossing it against the suite.
export { NEVER_KEY_PATTERN, ORACLE_KEY_PATTERN, extractContractRules, parseFactTable, readFactsFromIcm } from './contract-facts.mjs'

/**
 * Audits whether every declared contract rule is referenced by at least one test.
 * @param {ReturnType<typeof extractContractRules>} rules
 * @param {Array<{ file: string, content: string }>} testSources
 * @returns {{ status: 'PASSED'|'FAILED'|'SKIPPED', totalRules: number,
 *   covered: Array<{ tag: string, kind: string, evidence: string }>,
 *   uncovered: Array<{ tag: string, kind: string, statement: string }>, timestamp: string }}
 */
/**
 * Markers an agent leaves when it finds the contract itself is inconsistent.
 *
 * A live cycle produced exactly this. The Owner wrote a BIC whose oracle
 * demanded `within` for a value the acceptance criteria placed in the `tight`
 * band — both could not hold. The delegated agent noticed, implemented the
 * internally consistent half, pinned the disputed point, and left a
 * `CONTRADICTION PENDING OWNER RESOLUTION` comment in a test that still cited
 * the tag verbatim.
 *
 * That is honest behaviour and exactly what one wants from the agent. What
 * one does NOT want is the gate reading that test as coverage: a contract
 * nobody can satisfy would ship reported as enforced. So a cited tag whose
 * only evidence carries an unresolved marker counts as UNCOVERED, and says so.
 */
const CONTRADICTION_MARKERS = [
  /CONTRADICTION\s+PENDING/i,
  /CONTRADICCI[OÓ]N\s+PENDIENTE/i,
  /CONTRACT\s+CONFLICT/i,
  /@bic-unresolved/i,
]

/** True when this source pins a disputed point instead of asserting the rule. */
function hasUnresolvedContradiction(content) {
  return CONTRADICTION_MARKERS.some((re) => re.test(content))
}

export function auditInvariantCoverage(rules = [], testSources = []) {
  const covered = []
  const uncovered = []

  for (const rule of rules) {
    const hits = testSources.filter((src) => src.content.includes(rule.tag))
    // A rule is covered by a test that ASSERTS it. One that only records a
    // dispute about it is evidence of a broken contract, not of enforcement.
    const hit = hits.find((src) => !hasUnresolvedContradiction(src.content))

    if (hit) {
      covered.push({ tag: rule.tag, kind: rule.kind, evidence: hit.file })
    } else if (hits.length > 0) {
      uncovered.push({
        tag: rule.tag,
        kind: rule.kind,
        statement: `${rule.statement} — el único test que lo cita marca una contradicción sin resolver (${hits[0].file})`,
      })
    } else {
      uncovered.push({ tag: rule.tag, kind: rule.kind, statement: rule.statement })
    }
  }

  let status = 'PASSED'
  if (rules.length === 0) status = 'SKIPPED'
  else if (uncovered.length > 0) status = 'FAILED'

  return {
    status,
    totalRules: rules.length,
    covered,
    uncovered,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Formats the audit into a compact Markdown block for the Verify Report.
 * @param {ReturnType<typeof auditInvariantCoverage>} audit
 * @returns {string}
 */
export function formatInvariantGateReport(audit) {
  if (audit.status === 'SKIPPED') {
    return '## Invariant Gate: ⏭️ SKIPPED\nNo BIC contract facts found for this workspace.'
  }

  const icon = audit.status === 'PASSED' ? '✅' : '🛑'
  const lines = [
    `## Invariant Gate: ${icon} ${audit.status}`,
    `Contract rules: ${audit.totalRules} | Covered: ${audit.covered.length} | Uncovered: ${audit.uncovered.length}`,
    '',
  ]

  if (audit.uncovered.length > 0) {
    lines.push('### Unenforced Contract Rules')
    for (const item of audit.uncovered) {
      lines.push(`- 🛑 \`${item.tag}\` (${item.kind}) — ${item.statement || 'no statement recorded'}`)
    }
    lines.push('')
    lines.push('Every rule above MUST be referenced by tag inside a test file.')
    return lines.join('\n').trim()
  }

  for (const item of audit.covered) {
    lines.push(`- ✅ \`${item.tag}\` — ${item.evidence}`)
  }
  return lines.join('\n').trim()
}

function parseArgValue(args, flag) {
  const index = args.indexOf(flag)
  return index !== -1 && args[index + 1] ? args[index + 1] : ''
}


// CLI Execution
export async function main() {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/sdd-lifecycle/invariant-gate.mjs [--entity <WORKSPACE>] ' +
        '[--facts-file <table.txt>] [--tests-dir <dir>] [--bic <BIC-ID>] [--json] [--exit-code]\n' +
        '\n--entity se resuelve solo (git remote origin, con fallback a\n' +
        'basename del directorio) cuando no se pasa --entity ni --facts-file.\n' +
        '\nExit codes (with --exit-code):\n' +
        '  0  PASSED, or SKIPPED when --entity is EXPLICIT and the workspace has no bic.* facts\n' +
        '  1  FAILED — a declared invariant or oracle has no test asserting it\n' +
        '  2  BLOCKED — the contract could not be read, OR an INFERRED entity has no\n' +
        '     bic.* facts. An inferred name cannot tell "this task never ran\n' +
        '     /sdd-frame" from "I guessed the wrong entity", and SKIPPED would be a\n' +
        '     silent pass on a guessed name. Pass --entity to assert it.\n'
    )
    process.exit(0)
  }

  const entity = parseArgValue(args, '--entity')
  const factsFile = parseArgValue(args, '--facts-file')
  const testsDir = parseArgValue(args, '--tests-dir') || process.cwd()
  const bicFilter = parseArgValue(args, '--bic')
  const asJson = args.includes('--json')
  const enforceExitCode = args.includes('--exit-code')

  // El contrato se consigue en su propio módulo: allá viven las guardias de
  // "¿leí algo?" y los tres caminos de entrada. Acá sólo importa que salga.
  const { rules } = acquireRules({ factsFile, entity, bicFilter })

  // Los tests que AOI instala citan los tags de AOI, y el match es una inclusión
  // literal de cadena: sin sacarlos, un BIC del producto que comparta número con
  // uno de AOI se reporta enforced sin que exista una sola prueba suya. La raíz
  // se deduce de dónde vive ESTE archivo, no de `cwd`, porque lo que hay que
  // ubicar es la instalación de AOI que se está ejecutando.
  const installRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const { kept: ownerSources, dropped: aoiOwned } = dropAoiOwnedTests(installRoot, collectTestSources(testsDir))

  const { kept, dropped, determinable, reason } = dropUnreachableTests(testsDir, ownerSources)

  // Si la alcanzabilidad es INDETERMINADA, un archivo que ningún runner colecta es
  // indistinguible de evidencia — y el gate no puede certificar cobertura con eso.
  // Bloquea, en vez de dejar que un `package.json` corrupto convierta un test
  // huérfano en la prueba de que el contrato está enforced.
  //
  // Es el mismo tercer estado que el gate ya distingue para el contrato: *no pude
  // leer* no es *no hay*. Y el Invariant Gate no es el único que lee este módulo,
  // así que la decisión se toma acá, donde se sabe qué significa para el veredicto.
  if (!determinable) {
    process.stderr.write(
      `Invariant Gate BLOCKED: no se pudo determinar qué tests colecta algún runner — ${reason}.\n` +
        'Sin esa respuesta no se puede distinguir un test que cita el tag de uno que ningún runner ejecuta.\n' +
        'Arreglá el package.json del árbol que estás auditando, o pasá --facts-file si querés auditar sólo el contrato.\n'
    )
    process.exit(2)
  }

  if (aoiOwned.length > 0) {
    // Dicho en voz alta: un contrato que queda sin cubrir porque su única cita
    // estaba en un test de AOI se parece demasiado a uno que nadie escribió.
    process.stderr.write(
      `ℹ️  ${aoiOwned.length} test(s) de AOI excluido(s) del barrido: sus tags son de AOI, no del contrato de este workspace.\n`
    )
  }

  if (dropped.length > 0) {
    // Named out loud: a contract that goes uncovered because its test is
    // unreachable looks identical to one nobody wrote, and the difference is
    // the whole fix.
    process.stderr.write(`⚠️  ${dropped.length} test(s) ignorado(s) porque ningún runner los colecta:\n`)
    for (const f of dropped) process.stderr.write(`     ${path.relative(testsDir, f)}\n`)
  }
  const audit = auditInvariantCoverage(rules, kept)

  if (asJson) {
    process.stdout.write(JSON.stringify(audit, null, 2) + '\n')
  } else {
    process.stdout.write(formatInvariantGateReport(audit) + '\n')
  }

  if (enforceExitCode && audit.status === 'FAILED') {
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
