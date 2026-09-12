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
import { collectTestSources, dropUnreachableTests } from './test-reachability.mjs'
import { resolveWorkspaceEntity } from './workspace-identity.mjs'

// Re-exported: collecting test sources moved to test-reachability.mjs when this
// file crossed 300 LOC, but it is part of this module's public surface and
// callers should not have to know where the split landed.
export { collectTestSources } from './test-reachability.mjs'

// Re-exported for the same reason, when the entity-resolution work pushed this
// file over the line again: reading and parsing the contract is a different
// question from crossing it against the suite.
export { NEVER_KEY_PATTERN, ORACLE_KEY_PATTERN, extractContractRules, parseFactTable, readFactsFromIcm } from './contract-facts.mjs'
import { extractContractRules, parseFactTable, readFactsFromIcm } from './contract-facts.mjs'

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

/**
 * Reads an entity's fact table, blocking with exit 2 when the ICM toolchain
 * cannot answer. Never pass silently on a broken toolchain: absence of evidence
 * is not evidence of compliance. A distinct exit code because "could not read
 * the contract" and "read it and it failed" need different fixes.
 */
function readEntityFacts(entity) {
  const read = readFactsFromIcm(entity)
  if (!read.ok) {
    // Las DOS salidas tienen que estar nombradas en las dos formas de bloqueo.
    // Antes este mensaje sólo ofrecía `--facts-file`, y el de la entidad
    // inferida sólo `--entity`: un test que exigía "dice cómo desbloquearse"
    // pasaba en el repositorio y fallaba en la instalación, donde la inferencia
    // cae en otra rama. El mensaje tiene que ser útil sin importar por cuál de
    // los dos caminos se llegó.
    process.stderr.write(
      `Invariant Gate BLOCKED: cannot read BIC facts for "${entity}" because ${read.reason}.\n` +
        'Fix the ICM toolchain, confirm the entity with --entity <WORKSPACE>, ' +
        'or pass --facts-file to audit from a captured table.\n'
    )
    process.exit(2)
  }
  return read.text
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
        '  0  PASSED or SKIPPED (no BIC facts for this workspace)\n' +
        '  1  FAILED — a declared invariant or oracle has no test asserting it\n' +
        '  2  BLOCKED — the contract could not be read (broken ICM toolchain or missing facts file)\n'
    )
    process.exit(0)
  }

  const entity = parseArgValue(args, '--entity')
  const factsFile = parseArgValue(args, '--facts-file')
  const testsDir = parseArgValue(args, '--tests-dir') || process.cwd()
  const bicFilter = parseArgValue(args, '--bic')
  const asJson = args.includes('--json')
  const enforceExitCode = args.includes('--exit-code')

  let factTable = ''
  if (factsFile) {
    if (!fs.existsSync(factsFile)) {
      process.stderr.write(`Invariant Gate BLOCKED: --facts-file not found: ${factsFile}\n`)
      process.exit(2)
    }
    factTable = fs.readFileSync(factsFile, 'utf8')
  } else if (entity) {
    factTable = readEntityFacts(entity)
  } else {
    // Ni --entity ni --facts-file: la invocación desnuda. Resuelve sola en vez
    // de morir por uso, pero ANUNCIA qué entidad eligió y con qué criterio.
    const resolved = resolveWorkspaceEntity(process.cwd())
    process.stderr.write(resolved.notice)
    factTable = readEntityFacts(resolved.entity)

    // Y falla CERRADO si la entidad inferida no tiene contrato. Una entidad
    // inferida no puede distinguir "la tarea nunca pasó por /sdd-frame" de
    // "adiviné el nombre equivocado". `SKIPPED` asume lo primero y sale 0; con
    // un nombre adivinado eso es un pase silencioso, que es justo el defecto
    // que este gate existe para impedir. Con `--entity` explícito sí vale el
    // `SKIPPED` documentado: alguien afirmó el nombre.
    if (extractContractRules(parseFactTable(factTable)).length === 0) {
      process.stderr.write(
        `Invariant Gate BLOCKED: la entidad inferida "${resolved.entity}" no tiene hechos bic.*.\n` +
          `Si "${resolved.entity}" es la correcta y la tarea no pasó por /sdd-frame, confirmala con --entity.\n`
      )
      process.exit(2)
    }
  }

  const rules = extractContractRules(parseFactTable(factTable), bicFilter)
  const { kept, dropped } = dropUnreachableTests(testsDir, collectTestSources(testsDir))
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
