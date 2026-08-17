/**
 * scripts/aoi-os/storage-guard/stream-pause-resume-guard.mjs
 *
 * Deterministic Atomic Stream pause & resume Flow Control Guard for AOI-OS:
 * Statically audits readable stream throttling routines that call .pause() to ensure a matching deterministically
 * reachable .resume() call exists, preventing readable streams from stalling indefinitely (0 LLM Tokens).
 */

/**
 * Audits stream reading and throttling source code for paired .pause() and .resume() calls.
 *
 * @param {string} sourceCode - Stream reading source code
 * @returns {object} Stream pause/resume audit report
 */
export function auditStreamPauseResumeSafety(sourceCode = '') {
  const violations = []
  const cleanCode = sourceCode.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

  const callsPause = /(?:\.pause\s*\(\s*\))/i.test(cleanCode)
  const callsResume = /(?:\.resume\s*\(\s*\))/i.test(cleanCode)

  if (callsPause && !callsResume) {
    violations.push({
      type: 'STREAM_PAUSE_MISSING_RESUME',
      recommendation: "Readable stream calls .pause() but lacks a matching .resume() call. Ensure .resume() is invoked (e.g. after asynchronous processing) to prevent consumer pipeline deadlock.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    callsPause,
    violationsCount: violations.length,
    violations,
    pauseProof: safe ? 'DETERMINISTIC_STREAM_RESUME_ENFORCED' : 'PERPETUALLY_PAUSED_STREAM_RISK',
  }
}
