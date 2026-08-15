/**
 * scripts/aoi-os/consensus-gate/consensus-arbitrator.mjs
 *
 * Deterministic Multi-Agent Consensus & Arbitration Gate for AOI-OS:
 * Evaluates code diffs and proposals against security invariants (OWASP/secrets),
 * architectural standards (<300 LOC/SRP), and generates consensus approval scores.
 */

/**
 * Checks code for security violations.
 *
 * @param {string} code
 * @param {string} filePath
 * @returns {{ passed: boolean, violations: string[] }}
 */
export function auditSecurityInvariants(code = '', filePath = '') {
  const violations = []
  if (!code || typeof code !== 'string') return { passed: true, violations }

  // 1. Hardcoded API keys / secrets
  const secretRegex = /(?:api[_-]?key|secret|password|bearer|auth[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-.~+/=]{8,}['"]/i
  if (secretRegex.test(code)) {
    violations.push(`Hardcoded secret or API credential detected in ${filePath}`)
  }

  // 2. Dangerous eval / Function constructor
  if (/\beval\s*\(/i.test(code) || /new\s+Function\s*\(/i.test(code)) {
    violations.push(`Dangerous dynamic evaluation (eval/Function) detected in ${filePath}`)
  }

  // 3. Unsanitized SQL concatenation
  const rawSqlRegex = /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\+\s*[A-Za-z0-9_$]+/i
  if (rawSqlRegex.test(code)) {
    violations.push(`Potential SQL injection via raw string concatenation detected in ${filePath}`)
  }

  // 4. Unsafe HTML rendering
  if (/v-html\s*=|dangerouslySetInnerHTML\s*=/i.test(code)) {
    violations.push(`Unsafe raw HTML injection detected in ${filePath}`)
  }

  return {
    passed: violations.length === 0,
    violations,
  }
}

/**
 * Checks code for architectural and quality standards.
 *
 * @param {string} code
 * @param {string} filePath
 * @param {object} [options]
 * @param {number} [options.maxLines=300] - Rule of 300 LOC per file
 * @returns {{ passed: boolean, warnings: string[], loc: number }}
 */
export function auditArchitecturePrinciples(code = '', filePath = '', options = {}) {
  const { maxLines = 300 } = options
  const warnings = []
  const lines = code ? code.split('\n') : []
  const loc = lines.length

  // 1. Check max LOC (300 lines limit rule)
  if (loc > maxLines) {
    warnings.push(
      `File ${filePath} exceeds standard LOC threshold (${loc}/${maxLines} lines). Consider splitting into composables/modules.`
    )
  }

  // 2. Check for TODO / FIXME tags left in code
  const todoMatches = code.match(/\b(?:TODO|FIXME|HACK)\b/gi)
  if (todoMatches && todoMatches.length > 3) {
    warnings.push(`High density of unresolved TODO/FIXME markers (${todoMatches.length}) in ${filePath}`)
  }

  return {
    passed: warnings.length === 0,
    warnings,
    loc,
  }
}

/**
 * Computes a weighted consensus approval score.
 *
 * @param {object} options
 * @param {string} options.code
 * @param {string} [options.filePath='file.ts']
 * @param {boolean} [options.testsPassed=true]
 * @param {boolean} [options.astInvariantSafe=true]
 * @returns {{ approved: boolean, score: number, securityAudit: object, archAudit: object, feedback: string[] }}
 */
export function evaluateConsensusGate(options) {
  const {
    code = '',
    filePath = 'file.ts',
    testsPassed = true,
    astInvariantSafe = true,
  } = options

  const securityAudit = auditSecurityInvariants(code, filePath)
  const archAudit = auditArchitecturePrinciples(code, filePath)

  let score = 100
  const feedback = []

  // 1. Security deductions (Hard failure: -50 per violation)
  if (!securityAudit.passed) {
    score -= securityAudit.violations.length * 50
    feedback.push(...securityAudit.violations.map((v) => `[SECURITY] ${v}`))
  }

  // 2. AST Contract Invariant deductions (-30 if broken)
  if (!astInvariantSafe) {
    score -= 30
    feedback.push(`[CONTRACT] Public AST contract invariants were violated in ${filePath}`)
  }

  // 3. Test verification deductions (-40 if tests fail)
  if (!testsPassed) {
    score -= 40
    feedback.push(`[TESTS] Automated verification tests failed for ${filePath}`)
  }

  // 4. Architecture warnings deductions (-10 per warning)
  if (!archAudit.passed) {
    score -= archAudit.warnings.length * 10
    feedback.push(...archAudit.warnings.map((w) => `[ARCHITECTURE] ${w}`))
  }

  const finalScore = Math.max(0, Math.min(100, score))
  const approved = finalScore >= 85

  return {
    approved,
    score: finalScore,
    securityAudit,
    archAudit,
    feedback,
  }
}
