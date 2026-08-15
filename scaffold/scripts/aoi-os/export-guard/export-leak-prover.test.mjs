import test from 'node:test'
import assert from 'node:assert/strict'
import { auditExportLeaks } from './export-leak-prover.mjs'

test('auditExportLeaks proves hermetic boundaries when public package roots are imported', () => {
  const code = `
import { createPipeline } from 'aoi-os';
import { useAuth } from '@workspace/core';
`
  const result = auditExportLeaks(code, ['aoi-os', '@workspace/core'])
  assert.equal(result.hermetic, true)
  assert.equal(result.boundaryProof, 'PACKAGE_BOUNDARIES_HERMETIC')
  assert.equal(result.leaksCount, 0)
})

test('auditExportLeaks catches deep private/internal imports', () => {
  const code = `
import { secretKernel } from 'aoi-os/internal/hidden-kernel.ts';
import { rawDb } from '@workspace/core/private/db.ts';
`
  const result = auditExportLeaks(code, ['aoi-os', '@workspace/core'])
  assert.equal(result.hermetic, false)
  assert.equal(result.boundaryProof, 'EXPORT_LEAK_VIOLATION_DETECTED')
  assert.equal(result.leaksCount, 2)
  assert.equal(result.leaks[0].type, 'UNAUTHORIZED_INTERNAL_DEEP_IMPORT')
})
