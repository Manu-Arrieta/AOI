import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { LEDGER, REQUIRED_CLAIMS, auditClaimsEvidence, formatClaimsEvidence, unsupportedClaims } from './claims-evidence-ledger.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ROOT_WITH_SCAFFOLD = fs.existsSync(path.join(REPO, 'scaffold', 'package.json')) ? REPO : null

test('BIC-2026-006: current public claims are evidence-backed and qualified', (t) => {
  const audit = auditClaimsEvidence(REPO)
  if (!audit.applicable) {
    t.skip('installed workspace without internal claims ledger')
    return
  }
  assert.deepEqual(audit.errors, [])
  assert.ok(audit.scanned >= 5, `only ${audit.scanned} public surfaces were checked`)
})

test('BIC-2026-006: unsupported universal and stale-count claims are rejected', () => {
  const retired = unsupportedClaims('El Gateway reduce hasta un 85%, AOI ofrece memoria infinita y la suite tiene (134 tests).')
  assert.deepEqual(retired, ['universal MCP saving rate', 'fixed test-count claim', 'infinite-memory guarantee'])
})

test('BIC-2026-006: a missing claim row cannot turn the ledger green', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aoi-claims-'))
  try {
    const ledgerPath = path.join(root, LEDGER)
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true })
    fs.writeFileSync(ledgerPath, REQUIRED_CLAIMS.slice(1).map((id) => `| ${id} |`).join('\n'))
    const audit = auditClaimsEvidence(root)
    assert.ok(audit.errors.some((error) => error.includes('C-001')), audit.errors.join('\n'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('BIC-2026-006: an installed workspace without internal docs skips explicitly', () => {
  const result = formatClaimsEvidence({ applicable: false, errors: [], scanned: 0 })
  assert.equal(result.code, 0)
  assert.match(result.text, /Sin ledger de claims/)
})

test('BIC-2026-006: the ledger gate remains wired into both global test chains', (t) => {
  if (!ROOT_WITH_SCAFFOLD) {
    t.skip('installed scaffold without its AOI source checkout')
    return
  }
  for (const filename of ['package.json', 'scaffold/package.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_WITH_SCAFFOLD, filename), 'utf8'))
    assert.match(manifest.scripts['aoi:claims'], /claims-evidence-ledger\.mjs/)
    assert.match(manifest.scripts.test, /pnpm aoi:claims/)
  }
})
