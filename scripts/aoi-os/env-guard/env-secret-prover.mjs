/**
 * scripts/aoi-os/env-guard/env-secret-prover.mjs
 *
 * Deterministic Environment Variable Drift & Secret Leak Prover for AOI-OS:
 * Statically validates process.env usages against declared env schemas and detects hardcoded secrets/API keys (0 LLM Tokens).
 */

const SECRET_PATTERNS = [
  { pattern: /['"][a-zA-Z0-9_-]{20,}\.sk_[a-zA-Z0-9_-]{20,}['"]/g, name: 'STRIPE_SECRET_KEY' },
  { pattern: /['"]sk-[a-zA-Z0-9]{32,}['"]/g, name: 'OPENAI_API_KEY' },
  { pattern: /['"]ghp_[a-zA-Z0-9]{36}['"]/g, name: 'GITHUB_PAT_TOKEN' },
  { pattern: /['"]AKIA[0-9A-Z]{16}['"]/g, name: 'AWS_ACCESS_KEY_ID' },
]

/**
 * Audits source code for environment variable compliance and embedded secrets.
 *
 * @param {string} sourceCode - Source code to audit
 * @param {string[]} declaredEnvVars - List of allowed/declared env variables (e.g. ['DATABASE_URL', 'PORT'])
 * @returns {object} Audit report
 */
export function auditEnvAndSecrets(sourceCode = '', declaredEnvVars = []) {
  const secretViolations = []
  const undeclaredEnvVars = []

  // 1. Check for embedded secrets
  for (const rule of SECRET_PATTERNS) {
    if (rule.pattern.test(sourceCode)) {
      secretViolations.push({
        type: rule.name,
        recommendation: `Remove hardcoded secret of type '${rule.name}' and supply via environment variable.`,
      })
    }
  }

  // 2. Check for process.env references against declared list
  if (declaredEnvVars.length > 0) {
    const envMatches = sourceCode.matchAll(/process\.env\.([a-zA-Z0-9_]+)/g)
    for (const match of envMatches) {
      const varName = match[1]
      if (!declaredEnvVars.includes(varName) && varName !== 'NODE_ENV') {
        undeclaredEnvVars.push({
          varName,
          type: 'UNDECLARED_ENVIRONMENT_VARIABLE',
          recommendation: `Declare '${varName}' in .env.example or schema.`,
        })
      }
    }
  }

  const safe = secretViolations.length === 0 && undeclaredEnvVars.length === 0

  return {
    safe,
    secretViolationsCount: secretViolations.length,
    secretViolations,
    undeclaredEnvCount: undeclaredEnvVars.length,
    undeclaredEnvVars,
    envProof: safe ? 'ENV_AND_SECRETS_COMPLIANT_AND_HERMETIC' : 'ENV_DRIFT_OR_SECRET_LEAK_DETECTED',
  }
}
