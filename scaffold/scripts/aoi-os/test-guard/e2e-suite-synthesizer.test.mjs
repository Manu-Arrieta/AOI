import test from 'node:test'
import assert from 'node:assert/strict'
import { extractScenariosFromSpec, synthesizeVitestSuite } from './e2e-suite-synthesizer.mjs'

test('extractScenariosFromSpec parses user stories and acceptance scenarios', () => {
  const spec = `
## User Story 1: JWT Authentication
### Scenario: Successful Login
- Given a registered user with valid credentials
- When the user submits email and password
- Then a signed JWT token is returned

## User Story 2: Password Reset
### Scenario: Reset Request Sent
- When an email is submitted
- Then a reset link is sent
`
  const scenarios = extractScenariosFromSpec(spec)
  assert.equal(scenarios.length, 2)
  assert.equal(scenarios[0].scenario, 'Successful Login')
  assert.equal(scenarios[0].steps.length, 3)
  assert.equal(scenarios[1].scenario, 'Reset Request Sent')
  assert.equal(scenarios[1].steps.length, 2)
})

test('synthesizeVitestSuite generates valid Vitest executable code', () => {
  const scenarios = [
    {
      story: 'Auth',
      scenario: 'User logs in',
      steps: ['Given valid email', 'Then return JWT'],
    },
  ]
  const suite = synthesizeVitestSuite({ suiteName: 'Auth Acceptance', scenarios })
  assert.ok(suite.includes("describe('Auth Acceptance'"))
  assert.ok(suite.includes("test('User logs in'"))
  assert.ok(suite.includes('// Step: Given valid email'))
  assert.ok(suite.includes('expect(true).toBe(true)'))
})
