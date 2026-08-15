import test from 'node:test'
import assert from 'node:assert/strict'
import { neutralizeEpistemicBias } from './epistemic-bias-neutralizer.mjs'

test('neutralizeEpistemicBias passes clean objective assertions with score 100', () => {
  const text = 'Implemented HMAC-SHA256 signature verification in auth.ts with 0 errors.'
  const result = neutralizeEpistemicBias(text)

  assert.equal(result.detectedBiasesCount, 0)
  assert.equal(result.objectivityScore, 100)
  assert.equal(result.biasStatus, 'FULLY_OBJECTIVE_FACTUAL')
  assert.equal(result.neutralizedText, text)
})

test('neutralizeEpistemicBias removes fluff and buzzwords to maximize factual signal', () => {
  const text = 'This revolutionary and blazingly fast feature seamlessly improves system synergy.'
  const result = neutralizeEpistemicBias(text)

  assert.ok(result.detectedBiasesCount >= 3)
  assert.equal(result.biasStatus, 'BIAS_NEUTRALIZED_AND_CLEANSED')
  assert.ok(!result.neutralizedText.includes('revolutionary'))
  assert.ok(!result.neutralizedText.includes('blazingly fast'))
  assert.ok(!result.neutralizedText.includes('seamlessly'))
})
