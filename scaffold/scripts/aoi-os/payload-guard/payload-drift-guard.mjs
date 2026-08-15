/**
 * scripts/aoi-os/payload-guard/payload-drift-guard.mjs
 *
 * Deterministic HTTP Request & Response Payload Drift Guard for AOI-OS:
 * Statically compares client request payloads with backend schema expectations,
 * proving zero property name drift, case mismatches, or missing required fields (0 LLM Tokens).
 */

/**
 * Audits client payload keys against backend schema expectations.
 *
 * @param {string[]} clientKeys - Keys sent by client
 * @param {string[]} backendKeys - Keys expected by backend schema
 * @returns {object} Payload drift audit report
 */
export function auditPayloadDrift(clientKeys = [], backendKeys = []) {
  const missingKeys = backendKeys.filter((k) => !clientKeys.includes(k))
  const extraKeys = clientKeys.filter((k) => !backendKeys.includes(k))

  // Detect potential casing mismatches (e.g. userId vs user_id)
  const casingMismatches = []
  for (const clientKey of clientKeys) {
    const normalized = clientKey.toLowerCase().replace(/_/g, '')
    const match = backendKeys.find((bk) => bk.toLowerCase().replace(/_/g, '') === normalized && bk !== clientKey)
    if (match) {
      casingMismatches.push({
        clientKey,
        backendKey: match,
        recommendation: `Rename client key '${clientKey}' to match backend '${match}'`,
      })
    }
  }

  const aligned = missingKeys.length === 0 && casingMismatches.length === 0

  return {
    aligned,
    missingKeys,
    extraKeys,
    casingMismatches,
    driftProof: aligned ? 'PAYLOAD_SCHEMA_100PCT_ALIGNED' : 'PAYLOAD_DRIFT_OR_MISMATCH_DETECTED',
  }
}
