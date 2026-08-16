import test from 'node:test'
import assert from 'node:assert/strict'
import { auditEnvAndSecrets } from './env-secret-prover.mjs'

test('auditEnvAndSecrets approves clean code with declared env vars', () => {
  const code = `
export const dbUrl = process.env.DATABASE_URL;
export const port = process.env.PORT || 3000;
`
  const declared = ['DATABASE_URL', 'PORT']
  const result = auditEnvAndSecrets(code, declared)
  assert.equal(result.safe, true)
  assert.equal(result.envProof, 'ENV_AND_SECRETS_COMPLIANT_AND_HERMETIC')
  assert.equal(result.secretViolationsCount, 0)
  assert.equal(result.undeclaredEnvCount, 0)
})

test('auditEnvAndSecrets detects hardcoded secrets and undeclared env variables', () => {
  const code = `
export const apiKey = "sk-abcdef1234567890abcdef1234567890";
export const secretToken = process.env.UNKNOWN_SECRET_VAR;
`
  const declared = ['DATABASE_URL', 'PORT']
  const result = auditEnvAndSecrets(code, declared)
  assert.equal(result.safe, false)
  assert.equal(result.envProof, 'ENV_DRIFT_OR_SECRET_LEAK_DETECTED')
  assert.equal(result.secretViolationsCount, 1)
  assert.equal(result.undeclaredEnvCount, 1)
  assert.equal(result.secretViolations[0].type, 'OPENAI_API_KEY')
  assert.equal(result.undeclaredEnvVars[0].varName, 'UNKNOWN_SECRET_VAR')
})
