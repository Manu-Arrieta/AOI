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
import { HELP, parseGateArgs, USAGE } from './invariant-gate-args.mjs'
import { tagSkippedOn } from './test-skip-scope.mjs'
import { noFacts, readFactsFromIcm } from './contract-facts.mjs'
import { resolveWorkspaceEntity } from './workspace-identity.mjs'

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
 * @returns {{ status: 'PASSED'|'PARTIAL'|'FAILED'|'SKIPPED', totalRules: number,
 *   covered: Array<{ tag: string, kind: string, evidence: string }>,
 *   uncovered: Array<{ tag: string, kind: string, statement: string }>,
 *   platformSkipped: Array<{ tag: string, kind: string, evidence: string, condition: string, platform: string }>,
 *   timestamp: string }}
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

export function auditInvariantCoverage(rules = [], testSources = [], { platform = process.platform } = {}) {
  const covered = []
  const uncovered = []
  const platformSkipped = []

  for (const rule of rules) {
    const hits = testSources.filter((src) => src.content.includes(rule.tag))
    // A rule is covered by a test that ASSERTS it. One that only records a
    // dispute about it is evidence of a broken contract, not of enforcement.
    const asserting = hits.filter((src) => !hasUnresolvedContradiction(src.content))
    // Y que además CORRE acá (C4, auditoría 2026-09-30): en macOS
    // `BIC-2026-003:never.2/never.3` figuraban ✅ con un único test que lleva
    // `skip: process.platform !== 'win32'`. Ver `test-skip-scope.mjs`.
    // Un `it.skip`/`.todo`/`{ skip: true }` no corre en ninguna: no es PARTIAL sino
    // no cubierta (el verificador midió dos reglas así reportadas PARTIAL, exit 0).
    const scoped = asserting.map((src) => ({ src, ...tagSkippedOn(src.content, rule.tag, platform) }))
    const runsHere = scoped.find((s) => !s.skipped)
    const elsewhere = scoped.find((s) => s.scope === 'platform')

    if (runsHere) {
      covered.push({ tag: rule.tag, kind: rule.kind, evidence: runsHere.src.file })
    } else if (elsewhere) {
      platformSkipped.push({ tag: rule.tag, kind: rule.kind, evidence: elsewhere.src.file, condition: elsewhere.condition, platform })
    } else if (scoped.length > 0) {
      const off = scoped[0]
      uncovered.push({ tag: rule.tag, kind: rule.kind, statement: `${rule.statement} — su único test está desactivado sin condición de plataforma (\`${off.condition}\`, ${off.src.file})` })
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

  // PARTIAL es un estado propio y no un PASSED con nota al pie: la regla tiene
  // test, pero en esta plataforma nadie lo ejecuta. Sale 0 aun con --exit-code
  // —ver `exitCodeFor`—, y el encabezado nunca dice PASSED.
  let status = 'PASSED'
  if (rules.length === 0) status = 'SKIPPED'
  else if (uncovered.length > 0) status = 'FAILED'
  else if (platformSkipped.length > 0) status = 'PARTIAL'

  return {
    status,
    totalRules: rules.length,
    covered,
    uncovered,
    platformSkipped,
    timestamp: new Date().toISOString(),
  }
}

/**
 * El código de salida de un veredicto bajo `--exit-code`.
 *
 * PARTIAL sale 0, y es una decisión: el gate existe para cazar reglas que NADIE
 * testea, y una regla con un test acotado a otra plataforma sí tiene quien la
 * vigile — en esa plataforma. Sólo esa: un skip incondicional no lo vigila nadie
 * y llega acá como FAILED (ver `skipScope` en `test-skip-scope.mjs`). Exigir 1 en macOS pediría verificar acá algo que
 * acá no se puede ejecutar, y la única salida barata sería borrar el `skip` o el
 * tag. Lo que no puede pasar es leerlo como completo: por eso no cuenta como
 * cubierta, el encabezado dice PARTIAL y cada regla nombra su plataforma.
 */
export function exitCodeFor(status) {
  return status === 'FAILED' ? 1 : 0
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

  const icon = { PASSED: '✅', PARTIAL: '⚠️' }[audit.status] ?? '🛑'
  const skipped = audit.platformSkipped ?? []
  const lines = [
    `## Invariant Gate: ${icon} ${audit.status}`,
    `Contract rules: ${audit.totalRules} | Covered: ${audit.covered.length} | Uncovered: ${audit.uncovered.length}` +
      (skipped.length > 0 ? ` | Skipped on ${skipped[0].platform}: ${skipped.length}` : ''),
    '',
  ]

  if (skipped.length > 0) {
    lines.push(`### Rules whose only test does not run on ${skipped[0].platform}`)
    for (const item of skipped) {
      lines.push(`- ⏸️ \`${item.tag}\` — not verified here (\`${item.condition}\`) — ${item.evidence}`)
    }
    lines.push('')
  }

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

/**
 * ¿El contrato es inalcanzable desde acá? Sólo para `--chain`.
 *
 * Con `--chain` el gate corre dentro de `pnpm test` (C3, auditoría 2026-09-30:
 * CLAUDE.md afirmaba que la cadena lo corría y no lo corría). El contrato vive en
 * el ICM LOCAL, no en el árbol, y hay dos lugares medidos donde no se alcanza:
 * una instalación core nueva —la entidad inferida no tiene hechos `bic.*`, y con
 * `--exit-code` la cadena de TODO workspace nuevo quedaba en rojo con 2— y el
 * runner de CI, que no tiene `icm` (ver `fake-icm.mjs`). Ahí se reporta NOT
 * AUDITED, en voz alta y con el motivo, y sale 0: es un "no sé", no un PASSED.
 * Lo que sigue bloqueando es lo que no es ausencia: un `icm` que falla, o una
 * tabla que llega y no se puede leer (`acquireRules`).
 *
 * @returns {{ entity: string, absent: string }} `absent` vacío si hay contrato
 */
export function chainContractAbsence(cwd) {
  const { entity, notice } = resolveWorkspaceEntity(cwd)
  process.stderr.write(notice)
  const read = readFactsFromIcm(entity)
  if (read.ok && !noFacts(read.text)) return { entity, absent: '' }
  if (!read.ok && !read.absent) return { entity, absent: '' }
  return { entity, absent: read.ok ? `"${entity}" no tiene hechos bic.*` : read.reason }
}

// CLI Execution
export async function main() {
  const parsed = parseGateArgs(process.argv.slice(2))
  if (parsed.error) {
    process.stderr.write(`Invariant Gate: ${parsed.error}\n${USAGE}`)
    process.exit(2)
  }
  const { entity: entityArg, factsFile, bicFilter, asJson, enforceExitCode, chain, help } = parsed.opts
  if (help) {
    process.stdout.write(HELP)
    process.exit(0)
  }
  const testsDir = parsed.opts.testsDir || process.cwd()
  const installRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

  let entity = entityArg
  if (chain && !entity && !factsFile) {
    const chained = chainContractAbsence(process.cwd())
    if (chained.absent) {
      const notAudited = { status: 'NOT_AUDITED', reason: chained.absent, covered: [], timestamp: new Date().toISOString() }
      process.stdout.write(asJson ? `${JSON.stringify(notAudited, null, 2)}\n`
        : `## Invariant Gate: ⏭️ NOT AUDITED\nContrato inalcanzable desde acá: ${chained.absent}. Nada se dio por cubierto.\n`)
      return
    }
    entity = chained.entity
  }

  // El contrato se consigue en su propio módulo: allá viven las guardias de
  // "¿leí algo?" y los tres caminos de entrada. Acá sólo importa que salga.
  const { rules } = acquireRules({ factsFile, entity, bicFilter })

  // Los tests que AOI instala citan los tags de AOI, y el match es una inclusión
  // literal de cadena: sin sacarlos, un BIC del producto que comparta número con
  // uno de AOI se reporta enforced sin que exista una sola prueba suya. La raíz
  // se deduce de dónde vive ESTE archivo, no de `cwd`, porque lo que hay que
  // ubicar es la instalación de AOI que se está ejecutando.
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

  if (enforceExitCode && exitCodeFor(audit.status) !== 0) {
    process.exit(exitCodeFor(audit.status))
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
