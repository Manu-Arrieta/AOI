import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateNashEquilibrium } from './epistemic-game-engine.mjs'

test('calculateNashEquilibrium approves optimal proposal when all agent payoffs are positive', () => {
  const result = calculateNashEquilibrium({
    testsPassed: true,
    securitySafe: true,
    contractsIntact: true,
    performanceScore: 95,
  })

  assert.equal(result.isNashOptimal, true)
  assert.equal(result.consensusVerdict, 'NASH_EQUILIBRIUM_APPROVED')
  assert.equal(result.equilibriumScore, 100)
  assert.equal(result.totalPayoff, 40)
})

test('calculateNashEquilibrium vetoes proposal when a critical invariant is breached', () => {
  const result = calculateNashEquilibrium({
    testsPassed: true,
    securitySafe: false, // Security violation
    contractsIntact: true,
    performanceScore: 90,
  })

  assert.equal(result.isNashOptimal, false)
  assert.equal(result.consensusVerdict, 'NASH_EQUILIBRIUM_VETOED')
  assert.equal(result.payoffs.security, -10)
})
