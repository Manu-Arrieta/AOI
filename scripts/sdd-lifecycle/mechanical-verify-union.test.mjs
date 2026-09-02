import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  unifyVerificationReports,
  formatUnifiedVerificationReport,
  validateFileSizes,
  validateTddCompliance,
} from './mechanical-verify-union.mjs'

test('unifyVerificationReports returns PASSED for empty reports', () => {
  const unified = unifyVerificationReports([])
  assert.equal(unified.status, 'PASSED')
  assert.equal(unified.totalDefects, 0)
})

test('unifyVerificationReports merges duplicate defect IDs across multiple sources', () => {
  const reportA = {
    source: 'frontend-test',
    failedTests: ['TaskBoard.test.ts > renders correctly', 'useToken.test.ts > formats count'],
    lintErrors: [{ rule: 'vue/no-unused-vars', file: 'TaskBoard.vue', line: 12 }],
  }

  const reportB = {
    source: 'qa-integration',
    failedTests: ['TaskBoard.test.ts > renders correctly', 'e2e/smoke.test.ts > loads dashboard'],
    typeErrors: [{ file: 'locales.ts', code: 'TS2322' }],
    contractViolations: ['Missing schema export'],
  }

  const unified = unifyVerificationReports([reportA, reportB])
  assert.equal(unified.status, 'FAILED')
  assert.equal(unified.totalDefects, 6) // 3 tests + 1 lint + 1 type + 1 contract
  assert.equal(unified.failedTests.length, 3)
  assert.equal(unified.lintErrors.length, 1)
  assert.equal(unified.typeErrors.length, 1)
  assert.equal(unified.contractViolations.length, 1)
  assert.deepEqual(unified.sources, ['frontend-test', 'qa-integration'])
})

test('formatUnifiedVerificationReport renders clean markdown report', () => {
  const report = {
    source: 'unit-test',
    failedTests: ['Math.test.ts > adds correctly'],
    lintErrors: [],
    typeErrors: [],
    contractViolations: [],
  }
  const unified = unifyVerificationReports([report])
  const formatted = formatUnifiedVerificationReport(unified)

  assert.ok(formatted.includes('❌ Verification Summary: FAILED'))
  assert.ok(formatted.includes('Failed Tests (1)'))
  assert.ok(formatted.includes('- ✗ Math.test.ts > adds correctly'))
})

test('validateFileSizes detects files exceeding LOC limit', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loc-test-'))
  const smallFile = path.join(tmpDir, 'small.js')
  const largeFile = path.join(tmpDir, 'large.js')

  fs.writeFileSync(smallFile, 'const a = 1;\n'.repeat(50))
  fs.writeFileSync(largeFile, 'const b = 2;\n'.repeat(350))

  const violations = validateFileSizes([smallFile, largeFile], 300)
  assert.equal(violations.length, 1)
  assert.equal(violations[0].file, largeFile)
  assert.ok(violations[0].lines > 300)

  fs.rmSync(tmpDir, { recursive: true, force: true })
})

test('validateTddCompliance checks test coverage pairs', () => {
  const sourceFiles = ['src/auth/service.ts', 'src/utils/math.ts']
  const testFiles = ['tests/service.test.ts']

  const result = validateTddCompliance(sourceFiles, testFiles)
  assert.equal(result.compliant, false)
  assert.equal(result.missingTests.length, 1)
  assert.equal(result.missingTests[0], 'src/utils/math.ts')

  const completeTestFiles = ['tests/service.test.ts', 'tests/math.test.ts']
  const passResult = validateTddCompliance(sourceFiles, completeTestFiles)
  assert.equal(passResult.compliant, true)
  assert.equal(passResult.missingTests.length, 0)
})
