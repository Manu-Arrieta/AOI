import test from 'node:test'
import assert from 'node:assert/strict'
import { extractTypeContracts, extractScenarios, synthesizeTestSuite, synthesizeImplementationStub } from './synthesize-stubs.mjs'

test('extractTypeContracts extracts code blocks cleanly', () => {
  const md = `
# Design
\`\`\`typescript
export type FiberStatus = 'stable' | 'degraded' | 'critical'
export function evaluateFiberHealth(a: number, b: number): FiberStatus
\`\`\`
`
  const contracts = extractTypeContracts(md)
  assert.equal(contracts.length, 1)
  assert.match(contracts[0], /export type FiberStatus/)
})

test('extractScenarios parses Gherkin steps from spec markdown', () => {
  const spec = `
### Scenario: Stable fiber ratio
Given 10 active fibers
When 0 failed fibers
Then status is stable
`
  const scenarios = extractScenarios(spec)
  assert.equal(scenarios.length, 1)
  assert.equal(scenarios[0].title, 'Stable fiber ratio')
  assert.equal(scenarios[0].steps.length, 3)
})

test('synthesizeImplementationStub adds failing body to declared functions', () => {
  const contracts = [
    `export function calculateMetrics(x: number): number;`
  ]
  const stub = synthesizeImplementationStub(contracts)
  assert.match(stub, /throw new Error\('Not implemented: calculateMetrics'\)/)
})

test('synthesizeTestSuite creates Vitest suite with scenario comments and assertions', () => {
  const suite = synthesizeTestSuite({
    functionName: 'calculateMetrics',
    importPath: '../../server/utils/metrics',
    scenarios: [{ title: 'happy path', steps: ['Given input', 'Then output'] }]
  })
  assert.match(suite, /import \{ describe, it, expect \} from 'vitest'/)
  assert.match(suite, /import \{ calculateMetrics \} from '\.\.\/\.\.\/server\/utils\/metrics'/)
  assert.match(suite, /it\('happy path'/)
})
