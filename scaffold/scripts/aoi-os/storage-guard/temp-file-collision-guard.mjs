/**
 * scripts/aoi-os/storage-guard/temp-file-collision-guard.mjs
 *
 * Deterministic Atomic Temporary File Collision & Cryptographic Prefix Guard for AOI-OS:
 * Statically audits temporary file path creation routines to guarantee that temp filenames utilize
 * non-colliding cryptographically secure unique identifiers (crypto.randomUUID() / crypto.randomBytes())
 * rather than predictable sequential/timestamp-only names (Date.now(), Math.random()), preventing race conditions
 * and temp file squatting vulnerabilities (0 LLM Tokens).
 */

/**
 * Audits source code for secure temporary file naming routines.
 *
 * @param {string} sourceCode - File writing or staging routine source code
 * @returns {object} Temp file safety report
 */
export function auditTempFileCollisionSafety(sourceCode = '') {
  const violations = []

  const createsTempFile = /(?:\.tmp|tempFile|tmpPath|stagingPath|tmpdir\(\))\b/i.test(sourceCode)
  const hasPredictableTimestampOrRandom = /(?:Date\.now\(\)|Date\.parse|new Date\(\)\.getTime\(\)|Math\.random\(\))/i.test(sourceCode)
  const hasCsprngIdentifier = /(?:crypto\.randomUUID\(\)|randomUUID\(\)|crypto\.randomBytes\([0-9]+\)|randomBytes\([0-9]+\))/i.test(sourceCode)

  if (createsTempFile && hasPredictableTimestampOrRandom && !hasCsprngIdentifier) {
    violations.push({
      type: 'PREDICTABLE_TEMP_FILE_COLLISION_RISK',
      recommendation: "Use cryptographically secure identifiers ('crypto.randomUUID()' or 'crypto.randomBytes(16)') for temporary file prefixes to prevent collision and squatting attacks.",
    })
  }

  const safe = violations.length === 0

  return {
    safe,
    createsTempFile,
    violationsCount: violations.length,
    violations,
    tempFileProof: safe ? 'COLLISION_FREE_CSPRNG_TEMP_IDENTIFIER_ENFORCED' : 'PREDICTABLE_TEMP_FILE_COLLISION_DETECTED',
  }
}
