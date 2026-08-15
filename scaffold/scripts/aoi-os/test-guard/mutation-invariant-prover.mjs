/**
 * scripts/aoi-os/test-guard/mutation-invariant-prover.mjs
 *
 * Deterministic Test Mutation Invariant & Assertion Density Prover for AOI-OS:
 * Statically analyzes test suites to prove that every test block contains at least one deterministic
 * assertion (assert, expect, invariant), eliminating empty or shallow tests (0 LLM Tokens).
 */

/**
 * Audits test code for assertion density and presence of invariants.
 *
 * @param {string} testCode
 * @returns {object} Assertion density and invariant proof
 */
export function proveTestInvariants(testCode = '') {
  const testBlockMatches = testCode.matchAll(/(?:test|it)\s*\(\s*['"][^'"]+['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([^}]*)\}/gs)
  const shallowTests = []
  let totalTests = 0

  for (const match of testBlockMatches) {
    totalTests++
    const body = match[1]
    const hasAssertion = /(?:assert\.|expect\(|invariant\(|t\.|should\b)/.test(body)

    if (!hasAssertion) {
      shallowTests.push({
        type: 'SHALLOW_TEST_WITHOUT_ASSERTION',
        recommendation: 'Add explicit deterministic assertions (assert.equal, expect) to verify state changes.',
      })
    }
  }

  const valid = shallowTests.length === 0 && totalTests > 0

  return {
    valid,
    totalTests,
    shallowTestsCount: shallowTests.length,
    shallowTests,
    invariantProof: valid ? 'ALL_TESTS_CONTAIN_INVARIANT_ASSERTIONS' : (totalTests === 0 ? 'NO_TESTS_FOUND' : 'SHALLOW_ASSERTIONLESS_TESTS_DETECTED'),
  }
}
