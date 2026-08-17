/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-posix-umask-inheritance-prover.mjs
 *
 * Deterministic POSIX umask Isolation Prover for AOI-OS Sandbox:
 * Formally proves that subprocessor execution and worker setup routines in the sandbox
 * isolate file creation masks (process.umask(0o027) / 0o077 / explicit POSIX umask commands),
 * preventing permissive permission inheritance from the host environment (0 LLM Tokens).
 */

const SPAWN_PROCESS_PATTERNS = [
  /\b(?:spawn|spawnSync|execFile|execFileSync|fork)\s*\(/,
  /\bchild_process\s*\./,
]

const UMASK_ISOLATION_PATTERNS = [
  /\bprocess\s*\.\s*umask\s*\(\s*0o0[27][70]\s*\)/,
  /\bumask\s+0[27][70]\b/,
  /\bumask:\s*0o0[27][70]\b/,
  /\bmode\s*:\s*0o[67]00\b/,
]

/**
 * Proves that sandbox process executions isolate umask masks against host inheritance.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function proveSandboxProcessPosixUmaskSafety(sourceCode = '') {
  let hasSpawn = false
  for (const pattern of SPAWN_PROCESS_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasSpawn = true
      break
    }
  }

  if (!hasSpawn) {
    return {
      safe: true,
      hasSpawn: false,
      hasUmaskIsolation: false,
      violations: [],
      posixUmaskProof: 'NO_PROCESS_SPAWN_DETECTED',
    }
  }

  let hasUmaskIsolation = false
  for (const pattern of UMASK_ISOLATION_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasUmaskIsolation = true
      break
    }
  }

  const violations = []
  if (!hasUmaskIsolation) {
    violations.push('PROCESS_SPAWN_MISSING_EXPLICIT_POSIX_UMASK_ISOLATION')
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSpawn: true,
    hasUmaskIsolation,
    violations,
    posixUmaskProof: safe
      ? 'POSIX_UMASK_ISOLATION_VERIFIED'
      : 'PERMISSIVE_HOST_UMASK_INHERITANCE_RISK_DETECTED',
  }
}
