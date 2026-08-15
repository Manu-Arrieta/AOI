import test from 'node:test'
import assert from 'node:assert/strict'
import { auditConstitutionDrift } from './constitution-drift-auditor.mjs'

test('auditConstitutionDrift passes compliant TypeScript code', () => {
  const cleanCode = `
export interface User {
  id: string;
  name: string;
}

export function getUser(id: string): User {
  return { id, name: 'Alice' };
}
`
  const result = auditConstitutionDrift(cleanCode, 'server/user.ts')
  assert.equal(result.passed, true)
  assert.equal(result.complianceScore, 100)
  assert.equal(result.violations.length, 0)
})

test('auditConstitutionDrift flags violations when constitution rules are broken', () => {
  const nonCompliant = `
export function doStuff(data: any) {
  console.log("Debug: ", data);
}
`
  const result = auditConstitutionDrift(nonCompliant, 'server/service.ts')
  assert.ok(result.violations.some((v) => v.ruleId === 'NO_RAW_ANY'))
  assert.ok(result.violations.some((v) => v.ruleId === 'NO_CONSOLE_LOG'))
  assert.ok(result.complianceScore < 100)
})
