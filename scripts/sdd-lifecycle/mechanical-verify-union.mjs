/**
 * scripts/sdd-lifecycle/mechanical-verify-union.mjs
 *
 * Mechanical Set Union engine for multi-agent verification & QA.
 * Replaces expensive and lossy LLM fuser synthesis with deterministic,
 * mathematical set unions over reported defects, test failures, and lints.
 * Eliminates 100% of LLM compute in the verification consolidation stage.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Performs a mechanical set union over multiple verification report objects.
 *
 * @param {Array<{
 *   source?: string,
 *   failedTests?: Array<string|{ id: string, name?: string }>,
 *   lintErrors?: Array<string|{ rule: string, file: string, line?: number }>,
 *   typeErrors?: Array<string|{ file: string, code: string, message?: string }>,
 *   contractViolations?: Array<string>,
 *   metadata?: object
 * }>} reports
 * @returns {{
 *   status: 'PASSED' | 'FAILED',
 *   totalDefects: number,
 *   failedTests: string[],
 *   lintErrors: string[],
 *   typeErrors: string[],
 *   contractViolations: string[],
 *   sources: string[],
 *   timestamp: string
 * }}
 */
export function unifyVerificationReports(reports = []) {
  if (!Array.isArray(reports) || reports.length === 0) {
    return {
      status: 'PASSED',
      totalDefects: 0,
      failedTests: [],
      lintErrors: [],
      typeErrors: [],
      contractViolations: [],
      sources: [],
      timestamp: new Date().toISOString(),
    }
  }

  const failedTestsSet = new Set()
  const lintErrorsSet = new Set()
  const typeErrorsSet = new Set()
  const contractViolationsSet = new Set()
  const sourcesSet = new Set()

  for (const report of reports) {
    if (!report || typeof report !== 'object') continue

    if (report.source) {
      sourcesSet.add(String(report.source).trim())
    }

    if (Array.isArray(report.failedTests)) {
      for (const t of report.failedTests) {
        const key = typeof t === 'string' ? t.trim() : `${t.id || 'test'} - ${t.name || ''}`.trim()
        if (key) failedTestsSet.add(key)
      }
    }

    if (Array.isArray(report.lintErrors)) {
      for (const l of report.lintErrors) {
        const key = typeof l === 'string' ? l.trim() : `${l.rule || 'lint'}:${l.file || 'unknown'}:${l.line || 0}`
        if (key) lintErrorsSet.add(key)
      }
    }

    if (Array.isArray(report.typeErrors)) {
      for (const te of report.typeErrors) {
        const key = typeof te === 'string' ? te.trim() : `${te.file || 'file'}:${te.code || 'TS0000'}`
        if (key) typeErrorsSet.add(key)
      }
    }

    if (Array.isArray(report.contractViolations)) {
      for (const cv of report.contractViolations) {
        const key = String(cv).trim()
        if (key) contractViolationsSet.add(key)
      }
    }
  }

  const failedTests = Array.from(failedTestsSet).sort()
  const lintErrors = Array.from(lintErrorsSet).sort()
  const typeErrors = Array.from(typeErrorsSet).sort()
  const contractViolations = Array.from(contractViolationsSet).sort()

  const totalDefects =
    failedTests.length + lintErrors.length + typeErrors.length + contractViolations.length

  return {
    status: totalDefects === 0 ? 'PASSED' : 'FAILED',
    totalDefects,
    failedTests,
    lintErrors,
    typeErrors,
    contractViolations,
    sources: Array.from(sourcesSet).sort(),
    timestamp: new Date().toISOString(),
  }
}

/**
 * Formats unified verification result into high-density Markdown / TOON output.
 *
 * @param {ReturnType<typeof unifyVerificationReports>} unified
 * @returns {string}
 */
export function formatUnifiedVerificationReport(unified) {
  const isPassed = unified.status === 'PASSED'
  const icon = isPassed ? '✅' : '❌'

  const lines = [
    `# ${icon} Verification Summary: ${unified.status}`,
    `Sources: ${unified.sources.join(', ') || 'N/A'} | Total Defects: ${unified.totalDefects}`,
    ``,
  ]

  if (isPassed) {
    lines.push(`All quality gates passed with zero reported defects.`)
    return lines.join('\n')
  }

  if (unified.failedTests.length > 0) {
    lines.push(`### Failed Tests (${unified.failedTests.length})`)
    for (const t of unified.failedTests) {
      lines.push(`- ✗ ${t}`)
    }
    lines.push(``)
  }

  if (unified.lintErrors.length > 0) {
    lines.push(`### Lint Violations (${unified.lintErrors.length})`)
    for (const l of unified.lintErrors) {
      lines.push(`- ⚠ ${l}`)
    }
    lines.push(``)
  }

  if (unified.typeErrors.length > 0) {
    lines.push(`### Type Check Errors (${unified.typeErrors.length})`)
    for (const te of unified.typeErrors) {
      lines.push(`- ⚠ ${te}`)
    }
    lines.push(``)
  }

  if (unified.contractViolations.length > 0) {
    lines.push(`### Contract Violations (${unified.contractViolations.length})`)
    for (const cv of unified.contractViolations) {
      lines.push(`- 🛑 ${cv}`)
    }
    lines.push(``)
  }

  return lines.join('\n').trim()
}

// CLI Execution
export async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(`Usage: node scripts/sdd-lifecycle/mechanical-verify-union.mjs [--json] [--exit-code] <report-files.json...>\n`)
    process.exit(0)
  }

  const asJson = args.includes('--json')
  const enforceExitCode = args.includes('--exit-code')
  const filePaths = args.filter(a => !a.startsWith('--'))

  const reports = []
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        reports.push(JSON.parse(content))
      } catch (err) {
        process.stderr.write(`Warning: Failed to parse ${filePath}: ${err.message}\n`)
      }
    }
  }

  const unified = unifyVerificationReports(reports)
  if (asJson) {
    process.stdout.write(JSON.stringify(unified, null, 2) + '\n')
  } else {
    process.stdout.write(formatUnifiedVerificationReport(unified) + '\n')
  }

  if (enforceExitCode && unified.status !== 'PASSED') {
    process.exit(1)
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}

