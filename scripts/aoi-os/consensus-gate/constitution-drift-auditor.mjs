/**
 * scripts/aoi-os/consensus-gate/constitution-drift-auditor.mjs
 *
 * Deterministic Dynamic Constitution Drift Auditor for AOI-OS:
 * Validates code changes against repository architectural constitution invariants
 * with 0 LLM token consumption.
 */

export const CONSTITUTION_RULES = [
  {
    id: 'MAX_LOC_300',
    description: 'Files must not exceed 300 lines of code',
    check: (code, lines) => lines.length <= 300,
    weight: 25,
  },
  {
    id: 'NO_RAW_ANY',
    description: 'Explicit "any" types should be avoided in production TypeScript',
    check: (code, lines, filePath) => {
      if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return true
      return !/:\s*any\b/.test(code)
    },
    weight: 25,
  },
  {
    id: 'NO_CONSOLE_LOG',
    description: 'Production server code should not contain raw console.log',
    check: (code, lines, filePath) => {
      if (filePath.includes('.test.') || filePath.endsWith('.mjs')) return true
      return !/\bconsole\.log\s*\(/.test(code)
    },
    weight: 25,
  },
  {
    id: 'NO_DIRECT_MUTATION',
    description: 'Avoid mutating global window or process state directly',
    check: (code) => !/\bwindow\.\w+\s*=/.test(code),
    weight: 25,
  },
]

/**
 * Audits source code against constitution invariants.
 *
 * @param {string} sourceCode
 * @param {string} [filePath='file.ts']
 * @returns {object} Constitution compliance report
 */
export function auditConstitutionDrift(sourceCode = '', filePath = 'file.ts') {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return {
      filePath,
      complianceScore: 100,
      passed: true,
      violations: [],
    }
  }

  const lines = sourceCode.split('\n')
  const violations = []
  let totalScore = 100

  for (const rule of CONSTITUTION_RULES) {
    const passed = rule.check(sourceCode, lines, filePath)
    if (!passed) {
      totalScore -= rule.weight
      violations.push({
        ruleId: rule.id,
        description: rule.description,
        penalty: rule.weight,
      })
    }
  }

  const complianceScore = Math.max(0, totalScore)
  const passed = complianceScore >= 75

  return {
    filePath,
    complianceScore,
    passed,
    violations,
  }
}
