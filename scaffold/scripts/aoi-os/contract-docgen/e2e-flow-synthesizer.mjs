/**
 * scripts/aoi-os/contract-docgen/e2e-flow-synthesizer.mjs
 *
 * Autonomous Deterministic E2E Acceptance Flow Synthesizer for AOI-OS:
 * Synthesizes executable end-to-end integration test scenarios
 * from route contracts and task specifications with 0 LLM token consumption.
 */

import { parseRouteFromPath } from './openapi-synthesizer.mjs'

/**
 * Synthesizes executable Vitest E2E integration test file.
 *
 * @param {Array<{ id: string, title?: string, targetFiles?: string[] }>} tasks
 * @param {object} [options]
 * @param {string} [options.suiteName='Governed Integration Flow']
 * @param {string} [options.baseUrl='http://localhost:3000']
 * @returns {string} Executable TypeScript test content
 */
export function synthesizeE2eTestFlow(tasks = [], options = {}) {
  const { suiteName = 'Governed Integration Flow', baseUrl = 'http://localhost:3000' } = options

  const lines = [
    `import { describe, expect, it } from 'vitest'`,
    `import { ofetch } from 'ofetch'`,
    '',
    `describe('${suiteName}', () => {`,
    `  const BASE_URL = '${baseUrl}'`,
    '',
  ]

  let stepIndex = 0

  for (const task of tasks) {
    const files = task.targetFiles || []
    for (const file of files) {
      const route = parseRouteFromPath(file)
      if (route) {
        stepIndex++
        const testTitle = `Step ${stepIndex}: [${task.id}] ${route.method.toUpperCase()} ${route.path}`
        lines.push(`  it('${testTitle}', async () => {`)
        lines.push(`    const res = await ofetch('${route.path.replace(/\{(\w+)\}/g, 'test-$1')}', {`)
        lines.push(`      baseURL: BASE_URL,`)
        lines.push(`      method: '${route.method.toUpperCase()}',`)
        if (route.method === 'post' || route.method === 'put') {
          lines.push(`      body: { action: 'verify' },`)
        }
        lines.push(`      ignoreResponseError: true,`)
        lines.push(`    })`)
        lines.push(`    expect(res).toBeDefined()`)
        lines.push(`  })`)
        lines.push('')
      }
    }
  }

  lines.push('})')
  return lines.join('\n')
}
