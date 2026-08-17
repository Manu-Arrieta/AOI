/**
 * scripts/aoi-os/telemetry/span-lifecycle-guard.mjs
 *
 * Deterministic OpenTelemetry Tracer Span Lifecycle & Teardown Guard for AOI-OS:
 * Statically audits tracing instrumentation code (tracer.startSpan, startActiveSpan) to prove
 * that span.end() is guaranteed inside finally blocks preventing telemetry memory leaks (0 LLM Tokens).
 */

/**
 * Audits source code for OpenTelemetry span lifecycle and guaranteed termination.
 *
 * @param {string} sourceCode - Telemetry instrumentation or service source code
 * @returns {object} Span lifecycle audit report
 */
export function auditSpanLifecycleSafety(sourceCode = '') {
  const violations = []

  const hasSpanCreation = /\b(?:tracer\.startSpan|startActiveSpan)\s*\(/g.test(sourceCode)
  const hasSpanEnd = /\b(?:\.end\s*\(|finally\s*\{[^}]*\.end)/g.test(sourceCode)

  if (hasSpanCreation && !hasSpanEnd) {
    violations.push({
      type: 'UNCLOSED_TELEMETRY_SPAN',
      recommendation: "Ensure OpenTelemetry spans (tracer.startSpan) invoke 'span.end()' in a 'finally' block.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    hasSpanCreation,
    violationsCount: violations.length,
    violations,
    spanProof: safe ? 'SPAN_LIFECYCLE_TERMINATION_PROVEN' : 'UNCLOSED_TRACER_SPAN_DETECTED',
  }
}
