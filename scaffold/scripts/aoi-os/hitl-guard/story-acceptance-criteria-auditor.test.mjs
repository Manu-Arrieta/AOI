import test from 'node:test'
import assert from 'node:assert/strict'
import { proveStoryAcceptanceCriteriaAlignment } from './story-acceptance-criteria-auditor.mjs'

test('proveStoryAcceptanceCriteriaAlignment proves full alignment when tasks cover story criteria', () => {
  const spec = `
## User Story 1
As a user, I want authentication.
### Scenario: User logs in with valid email and password
- Given an active user
- When valid credentials submitted
- Then receive 200 OK and JWT
`
  const tasks = [
    {
      id: 'T-1',
      title: 'Build login endpoint',
      testRequirements: ['User logs in with valid email password credentials returning JWT'],
    },
  ]

  const result = proveStoryAcceptanceCriteriaAlignment(spec, tasks)
  assert.equal(result.aligned, true)
  assert.equal(result.alignmentProof, 'ACCEPTANCE_CRITERIA_100_PERCENT_COVERED')
  assert.equal(result.unmappedCount, 0)
  assert.equal(result.coveragePercentage, 100)
})

test('proveStoryAcceptanceCriteriaAlignment flags unmapped scenarios in DAG', () => {
  const spec = `
## User Story 1
### Scenario: User initiates biometric two-factor authentication passkey
`
  const tasks = [
    {
      id: 'T-1',
      title: 'Basic CSS styling',
      testRequirements: ['Check button color'],
    },
  ]

  const result = proveStoryAcceptanceCriteriaAlignment(spec, tasks)
  assert.equal(result.aligned, false)
  assert.equal(result.alignmentProof, 'UNMAPPED_ACCEPTANCE_CRITERIA_DETECTED')
  assert.equal(result.unmappedCount, 1)
})
