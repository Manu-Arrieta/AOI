/**
 * scripts/aoi-os/test-guard/flakiness-detector.mjs
 *
 * Deterministic Test Flakiness & Race Condition Detector for AOI-OS:
 * Scans test suites for asynchronous race conditions, timer dependencies,
 * and non-deterministic clock/randomness sources (0 LLM Tokens).
 */

export const FLAKINESS_INDICATORS = [
  {
    id: 'HARDCODED_TIMER',
    name: 'Hardcoded Timer / Delay',
    pattern: /\b(?:setTimeout|setInterval|sleep|delay)\s*\(\s*(?:[^,]+,\s*)?(\d+)/,
    severity: 'high',
    remediation: 'Use fake timers (e.g. vi.useFakeTimers()) instead of wall-clock timeouts',
  },
  {
    id: 'NON_DETERMINISTIC_RANDOM',
    name: 'Unseeded Random Number Generator',
    pattern: /\bMath\.random\s*\(\)/,
    severity: 'medium',
    remediation: 'Use a deterministic seeded PRNG or fixed test fixture values',
  },
  {
    id: 'SYSTEM_CLOCK_DEPENDENCY',
    name: 'Direct System Clock Dependency',
    pattern: /\b(?:Date\.now|new\s+Date)\s*\(\)/,
    severity: 'medium',
    remediation: 'Mock the system clock (e.g. vi.setSystemTime()) for reproducible tests',
  },
  {
    id: 'HARDCODED_PORT_BINDING',
    name: 'Hardcoded Network Port Binding',
    pattern: /\b(?:listen|port)\s*[:(]\s*(?:3000|8080|8000|5000)\b/,
    severity: 'high',
    remediation: 'Use ephemeral ports (port 0) to avoid concurrent test collisions',
  },
]

/**
 * Analyzes test source code for flakiness and race condition risks.
 *
 * @param {string} testCode
 * @param {string} [filePath='test.ts']
 * @returns {object} Flakiness risk assessment
 */
export function auditTestFlakiness(testCode = '', filePath = 'test.ts') {
  if (!testCode || typeof testCode !== 'string') {
    return {
      filePath,
      flakinessRisk: 'none',
      riskScore: 0,
      deterministic: true,
      findings: [],
    }
  }

  const lines = testCode.split('\n')
  const findings = []
  let totalPenalty = 0

  lines.forEach((line, idx) => {
    for (const indicator of FLAKINESS_INDICATORS) {
      if (indicator.pattern.test(line)) {
        const penalty = indicator.severity === 'high' ? 30 : 15
        totalPenalty += penalty
        findings.push({
          indicatorId: indicator.id,
          name: indicator.name,
          severity: indicator.severity,
          lineNumber: idx + 1,
          lineContent: line.trim(),
          remediation: indicator.remediation,
        })
      }
    }
  })

  const riskScore = Math.min(100, totalPenalty)
  let flakinessRisk = 'none'
  if (riskScore >= 60) flakinessRisk = 'critical'
  else if (riskScore >= 30) flakinessRisk = 'moderate'
  else if (riskScore > 0) flakinessRisk = 'low'

  return {
    filePath,
    flakinessRisk,
    riskScore,
    deterministic: findings.length === 0,
    findings,
  }
}
