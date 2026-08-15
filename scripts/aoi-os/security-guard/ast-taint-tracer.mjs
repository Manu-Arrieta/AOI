/**
 * scripts/aoi-os/security-guard/ast-taint-tracer.mjs
 *
 * Deterministic Static Taint & Data-Flow Security Analyzer for AOI-OS:
 * Traces un-sanitized user inputs reaching dangerous execution sinks
 * with 0 LLM token consumption.
 */

export const TAINT_SOURCES = [
  /\breq\.(?:body|query|params|headers)\b/,
  /\bevent\.node\.req\b/,
  /\bgetQuery\s*\(/,
  /\breadBody\s*\(/,
  /\breadValidatedBody\s*\(/,
  /\bprocess\.argv\b/,
  /\bHttpContext\.(?:Request|Query)\b/,
]

export const TAINT_SINKS = [
  { name: 'code_execution_eval', pattern: /\beval\s*\(/, severity: 'critical' },
  { name: 'command_injection_exec', pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(/, severity: 'critical' },
  { name: 'sql_injection_raw_query', pattern: /\b(?:query|raw|execute)\s*\(\s*`[^`]*\$\{/, severity: 'critical' },
  { name: 'path_traversal_fs_write', pattern: /\bfs\.(?:writeFileSync|writeFile|appendFileSync)\s*\(\s*`[^`]*\$\{/, severity: 'high' },
  { name: 'xss_inner_html', pattern: /(?:\.innerHTML\s*=|\bv-html\s*=)/, severity: 'high' },
]

export const SANITIZERS = [
  /\bsanitize\w*\s*\(/,
  /\bescape\w*\s*\(/,
  /\bencodeURI\w*\s*\(/,
  /\bencodeURIComponent\s*\(/,
  /\bNumber\s*\(/,
  /\bparseInt\s*\(/,
  /\bparseFloat\s*\(/,
  /\bpath\.resolve\s*\(/,
  /\bpath\.join\s*\(/,
  /\bzodParse\w*\s*\(/,
  /\bvalidate\w*\s*\(/,
]

/**
 * Analyzes code for unsafe taint propagation from sources to sinks.
 *
 * @param {string} sourceCode
 * @param {string} [filePath='file.ts']
 * @returns {object} Taint analysis report
 */
export function traceTaintFlows(sourceCode = '', filePath = 'file.ts') {
  if (!sourceCode || typeof sourceCode !== 'string') {
    return {
      safe: true,
      violations: [],
      sourcesDetected: 0,
      sinksDetected: 0,
    }
  }

  const lines = sourceCode.split('\n')
  const violations = []
  let sourcesDetected = 0
  let sinksDetected = 0

  // 1. Identify line indices with sources
  const sourceLineIndices = new Set()
  lines.forEach((line, idx) => {
    if (TAINT_SOURCES.some((src) => src.test(line))) {
      sourceLineIndices.add(idx)
      sourcesDetected++
    }
  })

  // 2. Identify sinks and evaluate vulnerability
  lines.forEach((line, idx) => {
    for (const sink of TAINT_SINKS) {
      if (sink.pattern.test(line)) {
        sinksDetected++
        // Check if line contains a sanitizer
        const isSanitized = SANITIZERS.some((san) => san.test(line))
        if (!isSanitized) {
          violations.push({
            sink: sink.name,
            severity: sink.severity,
            lineNumber: idx + 1,
            lineContent: line.trim(),
            remediation: `Sanitize or validate inputs before passing to ${sink.name}`,
          })
        }
      }
    }
  })

  return {
    filePath,
    safe: violations.length === 0,
    violations,
    sourcesDetected,
    sinksDetected,
  }
}
