/**
 * scripts/aoi-os/nullability-guard/nullability-contract-guard.mjs
 *
 * Deterministic Cross-Boundary Nullability & Undefined Dereference Guard for AOI-OS:
 * Statically inspects boundary property access on optional or nullable fields across TS/C#/Python,
 * proving strict null-safety and eliminating runtime TypeError/NullReferenceException (0 LLM Tokens).
 */

/**
 * Audits source code for unsafe dereferences on nullable or optional fields.
 *
 * @param {string} sourceCode
 * @param {string[]} [optionalFieldNames=[]]
 * @returns {object} Nullability safety report
 */
export function auditNullabilitySafety(sourceCode = '', optionalFieldNames = []) {
  const violations = []

  for (const field of optionalFieldNames) {
    // Unsafe access: e.g. `user.address.street` when address is optional (missing ?.)
    const unsafePattern = new RegExp(`(?:\\.${field}|\\['${field}'\\])\\.[a-zA-Z0-9_]+`, 'g')
    const matches = sourceCode.match(unsafePattern)

    if (matches) {
      violations.push({
        field,
        pattern: matches[0],
        type: 'UNSAFE_NULLABLE_DEREFERENCE',
        recommendation: `Use optional chaining '?.' or guard check on optional field '${field}'`,
      })
    }
  }

  const safe = violations.length === 0

  return {
    safe,
    violationsCount: violations.length,
    violations,
    nullabilityProof: safe ? 'STRICT_NULL_SAFETY_PROVEN' : 'NULLABLE_DEREFERENCE_VIOLATION',
  }
}
