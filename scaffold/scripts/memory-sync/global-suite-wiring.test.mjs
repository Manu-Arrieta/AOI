import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function auditMemorySyncSuiteWiring(scripts) {
  const global = String(scripts.test ?? '')
  return {
    globalMemorySyncRuns: (global.match(/\bpnpm\s+test:memory-sync(?!:bundle)\b/g) ?? []).length,
    globalBundleRuns: (global.match(/\bpnpm\s+test:memory-sync:bundle\b/g) ?? []).length,
    hasMemorySyncSuite: Boolean(scripts['test:memory-sync']),
    hasFocusedBundleSuite: Boolean(scripts['test:memory-sync:bundle']),
  }
}

describe('global memory-sync suite wiring', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))

  it('BIC-2026-004:never.1 runs the encompassing memory-sync glob exactly once globally', () => {
    const audit = auditMemorySyncSuiteWiring(pkg.scripts)

    assert.equal(audit.globalMemorySyncRuns, 1)
    assert.equal(audit.globalBundleRuns, 0)
  })

  it('BIC-2026-004:never.2 keeps both the full and focused commands available', () => {
    const audit = auditMemorySyncSuiteWiring(pkg.scripts)

    assert.equal(audit.hasMemorySyncSuite, true)
    assert.equal(audit.hasFocusedBundleSuite, true)
  })

  it('BIC-2026-004:oracle rejects the duplicate pipeline shape', () => {
    const duplicate = {
      ...pkg.scripts,
      test: `${pkg.scripts.test} && pnpm test:memory-sync:bundle`,
    }

    assert.equal(auditMemorySyncSuiteWiring(duplicate).globalBundleRuns, 1)
  })
})
