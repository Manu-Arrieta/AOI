import test from 'node:test'
import assert from 'node:assert/strict'
import { generateComplianceReport } from './compliance-report-generator.mjs'

test('generateComplianceReport aggregates compliant results and outputs Markdown', () => {
  const report = generateComplianceReport({
    workspace: 'AOI-Prod',
    taskId: 'TASK-2026-AUTH',
    auditResults: [
      { pillar: 'Atomic Fsync', safe: true, proof: 'ATOMIC_FILE_FSYNC_FLUSH_VERIFIED' },
      { pillar: 'RSA-PSS PKCS#8', safe: true, proof: 'SECURE_PKCS8_KEY_EXPORT_VERIFIED' },
      { pillar: 'AST Syntax', valid: true, proof: 'AST_STRUCTURAL_SYNTACTIC_INTEGRITY_VERIFIED' },
    ],
  })

  assert.equal(report.status, 'COMPLIANT')
  assert.equal(report.complianceScorePercentage, 100)
  assert.equal(report.passedAudits, 3)
  assert.equal(report.failedAudits, 0)

  const md = report.toMarkdown()
  assert.ok(md.includes('**COMPLIANT**'))
  assert.ok(md.includes('**Passed**: 3 / 3'))
})

test('generateComplianceReport reports violations and generates remediation details', () => {
  const report = generateComplianceReport({
    workspace: 'AOI-Prod',
    taskId: 'TASK-2026-FAIL',
    auditResults: [
      { pillar: 'Atomic Fsync', safe: true, proof: 'ATOMIC_FILE_FSYNC_FLUSH_VERIFIED' },
      {
        pillar: 'RSA-PSS Key Export',
        safe: false,
        proof: 'INSECURE_OR_LEGACY_KEY_EXPORT_FORMAT_DETECTED',
        violations: ['INSECURE_KEY_EXPORT_FORMAT: RSA-PSS private key must be exported as PKCS#8'],
        severity: 'CRITICAL',
      },
    ],
  })

  assert.equal(report.status, 'VIOLATIONS_DETECTED')
  assert.equal(report.complianceScorePercentage, 50)
  assert.equal(report.passedAudits, 1)
  assert.equal(report.failedAudits, 1)
  assert.equal(report.findings.length, 1)

  const md = report.toMarkdown()
  assert.ok(md.includes('**VIOLATIONS_DETECTED**'))
  assert.ok(md.includes('### 🔴 [CRITICAL] RSA-PSS Key Export'))
})
