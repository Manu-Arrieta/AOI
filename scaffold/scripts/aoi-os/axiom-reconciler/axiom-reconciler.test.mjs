import test from 'node:test'
import assert from 'node:assert/strict'
import { reconcileAxioms } from './axiom-reconciler.mjs'

test('reconcileAxioms proves equilibrium when tasks comply with all axioms', () => {
  const axioms = [
    'Use $fetch instead of raw fetch',
    'No inline styles allowed',
  ]

  const taskArtifacts = [
    {
      taskId: 'T-1',
      code: 'export async function getProfile() { return await $fetch("/api/user"); }',
    },
  ]

  const result = reconcileAxioms({ axioms, taskArtifacts })
  assert.equal(result.inEquilibrium, true)
  assert.equal(result.equilibriumStatus, 'AXIOMATIC_EQUILIBRIUM_VERIFIED')
  assert.equal(result.totalConflicts, 0)
})

test('reconcileAxioms detects violations and synthesizes deterministic auto-fix reconciliation plan', () => {
  const axioms = [
    'Use $fetch instead of raw fetch',
    'No inline styles allowed',
  ]

  const taskArtifacts = [
    {
      taskId: 'T-1',
      code: 'export async function getBad() { return await fetch("/api/user"); }',
    },
    {
      taskId: 'T-2',
      code: 'export const Template = `<div style="color: red">hello</div>`;',
    },
  ]

  const result = reconcileAxioms({ axioms, taskArtifacts })
  assert.equal(result.inEquilibrium, false)
  assert.equal(result.totalConflicts, 2)
  assert.equal(result.reconciliationPlan.length, 2)
  assert.ok(result.reconciliationPlan.some((p) => p.action === 'REPLACE_CALL'))
  assert.ok(result.reconciliationPlan.some((p) => p.action === 'MIGRATE_TO_UTILITY_CLASSES'))
})
