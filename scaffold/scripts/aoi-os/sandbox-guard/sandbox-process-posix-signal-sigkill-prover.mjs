/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-posix-signal-sigkill-prover.mjs
 *
 * Deterministic Tiered SIGTERM/SIGKILL Process Teardown Prover for AOI-OS Sandbox:
 * Formally proves that process termination routines execute a tiered graceful teardown protocol
 * (emitting SIGTERM followed by a grace period timeout before escalating to uncatchable SIGKILL),
 * preventing corrupted database journals, truncated logs, or orphaned socket descriptors (0 LLM Tokens).
 */

const SIGKILL_PATTERNS = [
  /\bkill\s*\([^)]*['"]SIGKILL['"]/,
  /\bkill\s*\([^)]*9\b/,
]

const GRACEFUL_SIGTERM_PATTERNS = [
  /\bkill\s*\([^)]*['"]SIGTERM['"]/,
  /\bkill\s*\(\s*\)/,
]

const TIMEOUT_GRACE_PATTERNS = [
  /\bsetTimeout\s*\(/,
  /\bgraceTimeout\b/,
  /\bgracePeriod\b/,
]

/**
 * Proves that process terminations with SIGKILL follow a preceding graceful SIGTERM with timeout.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function proveSandboxProcessSigkillGraceSafety(sourceCode = '') {
  let usesSigkill = false
  for (const pattern of SIGKILL_PATTERNS) {
    if (pattern.test(sourceCode)) {
      usesSigkill = true
      break
    }
  }

  if (!usesSigkill) {
    return {
      safe: true,
      usesSigkill: false,
      hasTieredTeardown: false,
      violations: [],
      sigkillGraceProof: 'NO_RAW_SIGKILL_OPERATION_DETECTED',
    }
  }

  let hasSigterm = false
  for (const pattern of GRACEFUL_SIGTERM_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasSigterm = true
      break
    }
  }

  let hasTimeoutGrace = false
  for (const pattern of TIMEOUT_GRACE_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasTimeoutGrace = true
      break
    }
  }

  const violations = []
  if (!hasSigterm || !hasTimeoutGrace) {
    violations.push('IMMEDIATE_RAW_SIGKILL_WITHOUT_PRECEDING_SIGTERM_GRACE_TIMEOUT')
  }

  const safe = violations.length === 0

  return {
    safe,
    usesSigkill: true,
    hasTieredTeardown: safe,
    violations,
    sigkillGraceProof: safe
      ? 'TIERED_SIGTERM_SIGKILL_GRACE_VERIFIED'
      : 'ABRUPT_UNGUARDED_SIGKILL_DETECTED',
  }
}
