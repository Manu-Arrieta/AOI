/**
 * scripts/aoi-os/fuzzing/adversarial-fuzzer.mjs
 *
 * Adversarial Edge-Case Synthesizer & Fuzzing Engine for AOI-OS:
 * Deterministically generates boundary and hostile edge-case input vectors
 * based on AST parameter signatures (TS, C#, Python) to catch silent bugs with 0 token waste.
 */

export const EDGE_CASE_VECTORS = {
  string: [
    '', // Empty string
    '   ', // Whitespace only
    'A'.repeat(5000), // Long string buffer
    '<script>alert(1)</script>', // XSS probe
    '\' OR 1=1; --', // SQL injection probe
    '../../../../etc/passwd', // Path traversal probe
    'null', // Stringified null
    'undefined', // Stringified undefined
    '🌟🔥🚀\u0000\uFFFF', // Unicode & null byte
  ],
  number: [
    0,
    -1,
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    NaN,
    Infinity,
    -Infinity,
    0.0000001,
  ],
  boolean: [true, false],
  object: [
    {},
    null,
    undefined,
    { __proto__: { admin: true } }, // Prototype pollution probe
  ],
  array: [
    [],
    [null],
    Array.from({ length: 1000 }, (_, i) => i), // Large array
  ],
}

/**
 * Generates an adversarial test suite matrix for given AST parameter signatures.
 *
 * @param {Array<{ name: string, type?: string }>} params - Parameter signatures
 * @param {object} [options]
 * @param {string} [options.functionName='targetFn']
 * @returns {{ functionName: string, testCasesCount: number, testVectors: Array<Record<string, unknown>> }}
 */
export function generateAdversarialVectors(params = [], options = {}) {
  const { functionName = 'targetFn' } = options
  if (!params.length) {
    return {
      functionName,
      testCasesCount: 0,
      testVectors: [],
    }
  }

  const testVectors = []

  // Generate test vector permutations
  for (const param of params) {
    const rawType = (param.type || 'string').toLowerCase()
    let vectors = EDGE_CASE_VECTORS.string

    if (rawType.includes('number') || rawType.includes('int') || rawType.includes('float')) {
      vectors = EDGE_CASE_VECTORS.number
    } else if (rawType.includes('bool')) {
      vectors = EDGE_CASE_VECTORS.boolean
    } else if (rawType.includes('[]') || rawType.includes('list') || rawType.includes('array')) {
      vectors = EDGE_CASE_VECTORS.array
    } else if (rawType.includes('{') || rawType.includes('object') || rawType.includes('dict')) {
      vectors = EDGE_CASE_VECTORS.object
    }

    for (const val of vectors.slice(0, 4)) {
      const vectorRecord = {}
      for (const p of params) {
        vectorRecord[p.name] = p.name === param.name ? val : 'default_valid_value'
      }
      testVectors.push(vectorRecord)
    }
  }

  return {
    functionName,
    testCasesCount: testVectors.length,
    testVectors,
  }
}
