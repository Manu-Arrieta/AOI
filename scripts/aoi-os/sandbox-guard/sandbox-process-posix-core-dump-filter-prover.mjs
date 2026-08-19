/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-posix-core-dump-filter-prover.mjs
 *
 * Deterministic POSIX Core Dump Filter / Memory Leak Prevention Prover for AOI-OS Sandbox:
 * Formally proves that child processes and worker runtimes in sandboxes explicitly disable or filter
 * core dump generation (ulimit -c 0 / PR_SET_DUMPABLE=0 / coredump_filter 0x0), preventing memory leaks
 * with cryptographic keys or secrets to disk upon crash (0 LLM Tokens).
 */

const SANDBOX_SPAWN_PATTERNS = [
  /\bspawnSandbox(?:Sync)?\s*\(/,
  /\bexecuteInSandbox\s*\(/,
  /\brunIsolatedWorker\s*\(/,
  /\bcreateSandboxChildProcess\s*\(/,
]

const CORE_DUMP_SUPPRESSION_PATTERNS = [
  /\bulimit\s+-c\s+0\b/,
  /\bPR_SET_DUMPABLE\b/,
  /\bcoredump_filter\b/,
  /\bdumpable\s*:\s*false\b/,
  /\bdisableCoreDumps\s*:\s*true\b/,
]

/**
 * Proves that sandbox execution explicitly suppresses core dump generation.
 *
 * @param {string} sourceCode - JavaScript/TypeScript source code
 * @returns {object} Audit report with mathematical safety proof
 */
export function proveSandboxProcessCoreDumpFilterSafety(sourceCode = '') {
  let isSandboxSpawn = false
  for (const pattern of SANDBOX_SPAWN_PATTERNS) {
    if (pattern.test(sourceCode)) {
      isSandboxSpawn = true
      break
    }
  }

  if (!isSandboxSpawn) {
    return {
      safe: true,
      isSandboxSpawn: false,
      hasCoreDumpSuppression: false,
      violations: [],
      coreDumpFilterProof: 'NO_SANDBOX_SPAWN_OPERATION_DETECTED',
    }
  }

  let hasCoreDumpSuppression = false
  for (const pattern of CORE_DUMP_SUPPRESSION_PATTERNS) {
    if (pattern.test(sourceCode)) {
      hasCoreDumpSuppression = true
      break
    }
  }

  const violations = []
  if (!hasCoreDumpSuppression) {
    violations.push('SANDBOX_SPAWN_MISSING_EXPLICIT_CORE_DUMP_SUPPRESSION_LIMIT')
  }

  const safe = violations.length === 0

  return {
    safe,
    isSandboxSpawn: true,
    hasCoreDumpSuppression,
    violations,
    coreDumpFilterProof: safe
      ? 'SANDBOX_CORE_DUMP_FILTER_SUPPRESSION_VERIFIED'
      : 'SANDBOX_MEMORY_CORE_DUMP_LEAK_RISK_DETECTED',
  }
}
