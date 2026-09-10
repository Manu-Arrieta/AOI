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
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { collectTestSources, dropUnreachableTests } from './test-reachability.mjs'

// Re-exported: collecting test sources moved to test-reachability.mjs when this
// file crossed 300 LOC, but it is part of this module's public surface and
// callers should not have to know where the split landed.
export { collectTestSources } from './test-reachability.mjs'

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

/**
 * Reads the fact table for an entity via the `icm` CLI.
 *
 * @param {string} entity
 * @returns {string}
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

function parseArgValue(args, flag) {
  const index = args.indexOf(flag)
  return index !== -1 && args[index + 1] ? args[index + 1] : ''
}

// CLI Execution
export async function main() {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(
      'Usage: node scripts/sdd-lifecycle/invariant-gate.mjs --entity <WORKSPACE> ' +
        '[--facts-file <table.txt>] [--tests-dir <dir>] [--bic <BIC-ID>] [--json] [--exit-code]\n' +
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
    const read = readFactsFromIcm(entity)
    if (!read.ok) {
      // Never pass silently on a broken toolchain: absence of evidence is not
      // evidence of compliance. Blocks with a distinct exit code (2 = tooling).
      process.stderr.write(
        `Invariant Gate BLOCKED: cannot read BIC facts for "${entity}" because ${read.reason}.\n` +
          'Fix the ICM toolchain or pass --facts-file to audit from a captured table.\n'
      )
      process.exit(2)
    }
    factTable = read.text
  } else {
    process.stderr.write('Error: provide --entity <WORKSPACE> or --facts-file <path>\n')
    process.exit(2)
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
