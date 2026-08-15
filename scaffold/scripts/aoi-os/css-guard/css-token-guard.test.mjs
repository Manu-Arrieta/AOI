import test from 'node:test'
import assert from 'node:assert/strict'
import { auditCssTokenDrift } from './css-token-guard.mjs'

test('auditCssTokenDrift approves code using only declared design tokens', () => {
  const code = `
.card {
  background: var(--bg-surface);
  padding: var(--space-4);
}
`
  const declared = ['--bg-surface', '--space-4']
  const result = auditCssTokenDrift(code, declared)
  assert.equal(result.valid, true)
  assert.equal(result.tokenProof, 'ALL_CSS_TOKENS_DECLARED_AND_CONVERGENT')
  assert.equal(result.undeclaredCount, 0)
})

test('auditCssTokenDrift detects undeclared or drifting CSS variables', () => {
  const code = `
.card {
  color: var(--color-unknown-brand);
}
`
  const declared = ['--bg-surface', '--space-4']
  const result = auditCssTokenDrift(code, declared)
  assert.equal(result.valid, false)
  assert.equal(result.tokenProof, 'UNDECLARED_CSS_TOKENS_DETECTED')
  assert.equal(result.undeclaredCount, 1)
  assert.equal(result.undeclaredTokens[0].token, '--color-unknown-brand')
})
