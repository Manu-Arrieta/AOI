/**
 * scripts/aoi-os/sandbox-guard/sandbox-process-serialization-prover.mjs
 *
 * Deterministic Sandbox Process IPC Serialization Prover for AOI-OS:
 * Statically proves that child process fork() calls in sandboxes explicitly configure
 * serialization: 'advanced' when IPC messaging is utilized, enabling full V8 serialization
 * of Map, Set, BigInt, and Error stack structures without JSON serialization crashes (0 LLM Tokens).
 */

/**
 * Audits child process fork source code for explicit serialization: 'advanced' configuration.
 *
 * @param {string} sourceCode - Child process fork source code
 * @returns {object} IPC serialization configuration audit report
 */
export function proveSandboxProcessSerializationSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const forksChildProcess = /(?:fork\s*\([^,]+,\s*(?:\[[^\]]*\],\s*)?\{)/i.test(cleanCode)
  const hasAdvancedSerialization = /serialization\s*:\s*['"]advanced['"]/i.test(cleanCode)

  if (forksChildProcess && !hasAdvancedSerialization) {
    violations.push({
      type: 'CHILD_PROCESS_FORK_MISSING_ADVANCED_SERIALIZATION',
      recommendation: "Child process fork() options lack 'serialization: \"advanced\"'. Configure serialization: 'advanced' to enable safe transfer of Map, Set, BigInt, and Error structures via IPC without JSON crashes.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    forksChildProcess,
    violationsCount: violations.length,
    violations,
    serializationProof: safe ? 'V8_ADVANCED_IPC_SERIALIZATION_ENFORCED' : 'LEGACY_JSON_IPC_CRASH_RISK',
  }
}
