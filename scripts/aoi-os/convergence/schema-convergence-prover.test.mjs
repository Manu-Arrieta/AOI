import test from 'node:test'
import assert from 'node:assert/strict'
import { proveSchemaConvergence } from './schema-convergence-prover.mjs'

test('proveSchemaConvergence proves 100% convergence between TypeScript and C# definitions', () => {
  const tsInterface = `
export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
}
`
  const csDto = `
public class UserProfileDto {
  public string Id { get; set; }
  public string Email { get; set; }
  public bool IsActive { get; set; }
}
`
  const result = proveSchemaConvergence(tsInterface, csDto)
  assert.equal(result.converged, true)
  assert.equal(result.convergenceScore, 100)
  assert.equal(result.convergenceProof, 'PROVEN_FULL_CONVERGENCE')
  assert.equal(result.missingFields.length, 0)
})

test('proveSchemaConvergence detects divergence when fields are missing in target', () => {
  const tsInterface = `
export interface Invoice {
  id: string;
  taxAmount: number;
  vatNumber: string;
}
`
  const csDto = `
public class InvoiceDto {
  public string Id { get; set; }
  public decimal TaxAmount { get; set; }
}
`
  const result = proveSchemaConvergence(tsInterface, csDto)
  assert.equal(result.converged, false)
  assert.equal(result.convergenceProof, 'DIVERGENCE_DETECTED')
  assert.ok(result.missingFields.includes('vatnumber'))
})
