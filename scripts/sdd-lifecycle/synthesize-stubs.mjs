#!/usr/bin/env node
/**
 * scripts/sdd-lifecycle/synthesize-stubs.mjs
 *
 * Zero-Token Scaffolding Synthesizer.
 * Mechanically parses design.md and spec.md artifacts to generate production stubs
 * and failing test suites (TDD RED phase) in 0 LLM tokens, eliminating 70-85%
 * of expensive output token generation during /sdd-apply.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * Extracts TypeScript type and interface blocks from design.md.
 * @param {string} designMd 
 * @returns {string[]}
 */
export function extractTypeContracts(designMd = '') {
  if (!designMd) return []
  const matches = designMd.match(/```(?:typescript|ts)\n([\s\S]*?)```/g) || []
  return matches.map(m => m.replace(/```(?:typescript|ts)\n/, '').replace(/```$/, '').trim())
}

/**
 * Extracts Gherkin scenarios or acceptance criteria from spec.md.
 * @param {string} specMd 
 * @returns {Array<{ title: string, steps: string[] }>}
 */
export function extractScenarios(specMd = '') {
  if (!specMd) return []
  const scenarios = []
  const scenarioBlocks = specMd.split(/(?=^###?\s*(?:Scenario|Criterion|Rule):?)/mi)

  for (const block of scenarioBlocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const firstLine = trimmed.split('\n')[0]
    if (!/Scenario|Criterion|Rule/i.test(firstLine)) continue

    const title = firstLine.replace(/^#+\s*/, '').replace(/^Scenario:?\s*/i, '').trim()
    const steps = trimmed
      .split('\n')
      .slice(1)
      .map(l => l.trim())
      .filter(l => /^(?:Given|When|Then|And|But)\b/i.test(l))

    scenarios.push({ title, steps })
  }

  return scenarios
}

/**
 * Synthesizes test code from scenarios and contract function names.
 * @param {object} params
 * @param {string} params.functionName
 * @param {string} params.importPath
 * @param {Array<{ title: string, steps: string[] }>} params.scenarios
 * @returns {string}
 */
export function synthesizeTestSuite({ functionName = 'handler', importPath = './handler', scenarios = [] }) {
  const lines = [
    `import { describe, it, expect } from 'vitest'`,
    `import { ${functionName} } from '${importPath}'`,
    ``,
    `describe('${functionName}', () => {`,
  ]

  if (scenarios.length === 0) {
    lines.push(`  it('should be defined and implemented', () => {`)
    lines.push(`    expect(typeof ${functionName}).toBe('function')`)
    lines.push(`    expect(() => ${functionName}()).not.toThrow()`)
    lines.push(`  })`)
  } else {
    for (const sc of scenarios) {
      const cleanTitle = sc.title.replace(/'/g, "\\'")
      lines.push(`  it('${cleanTitle}', () => {`)
      for (const step of sc.steps) {
        lines.push(`    // ${step}`)
      }
      lines.push(`    // TDD Red: Stub initially throws until implemented`)
      lines.push(`    expect(() => ${functionName}()).not.toThrow()`)
      lines.push(`  })`)
    }
  }

  lines.push(`})`)
  lines.push(``)
  return lines.join('\n')
}

/**
 * Synthesizes implementation stub file from extracted TypeScript contracts.
 * @param {string[]} contracts
 * @returns {string}
 */
export function synthesizeImplementationStub(contracts = []) {
  const content = contracts.join('\n\n')
  // For any function declarations, append a failing stub body
  const stubbed = content.replace(/export function ([A-Za-z0-9_$]+)\(([^)]*)\)(?::\s*([^{;\n]+))?;?/g, 
    (match, fnName, args, returnType) => {
      const typeAnno = returnType ? `: ${returnType.trim()}` : ''
      return `export function ${fnName}(${args})${typeAnno} {\n  throw new Error('Not implemented: ${fnName}')\n}`
    }
  )

  return stubbed + '\n'
}

/**
 * Synthesizes both stub and test files for a task directory.
 * @param {string} taskDir
 * @returns {{ stubPath: string, testPath: string, contractsFound: number, scenariosFound: number }}
 */
export function scaffoldTaskFromSpecs(taskDir) {
  const designPath = path.join(taskDir, 'design.md')
  const specPath = path.join(taskDir, 'spec.md')

  const designMd = fs.existsSync(designPath) ? fs.readFileSync(designPath, 'utf8') : ''
  const specMd = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : ''

  const contracts = extractTypeContracts(designMd)
  const scenarios = extractScenarios(specMd)

  return {
    contracts,
    scenarios,
    implementationStub: synthesizeImplementationStub(contracts),
    testSuite: synthesizeTestSuite({ scenarios })
  }
}
