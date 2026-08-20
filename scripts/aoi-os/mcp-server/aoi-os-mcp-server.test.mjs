import test from 'node:test'
import assert from 'node:assert/strict'
import { handleMcpToolCall, AOI_OS_MCP_TOOLS } from './aoi-os-mcp-server.mjs'

test('AOI_OS_MCP_TOOLS declares supported tool schemas', () => {
  assert.equal(AOI_OS_MCP_TOOLS.length, 3)
  assert.ok(AOI_OS_MCP_TOOLS.some((t) => t.name === 'aoi_os_analyze_ast'))
  assert.ok(AOI_OS_MCP_TOOLS.some((t) => t.name === 'aoi_os_schedule_dag'))
  assert.ok(AOI_OS_MCP_TOOLS.some((t) => t.name === 'aoi_os_generate_compliance_report'))
})

test('handleMcpToolCall executes aoi_os_analyze_ast tool', () => {
  const res = handleMcpToolCall('aoi_os_analyze_ast', {
    sourceCode: 'export function run() { return true; }',
  })
  assert.equal(res.isError, undefined)
  const parsed = JSON.parse(res.content[0].text)
  assert.equal(parsed.valid, true)
  assert.equal(parsed.isBalanced, true)
  assert.ok(parsed.declarations.some((d) => d.name === 'run'))
})

test('handleMcpToolCall executes aoi_os_schedule_dag tool and detects cycles', () => {
  const validRes = handleMcpToolCall('aoi_os_schedule_dag', {
    nodes: [
      { id: 'T-1', dependsOn: [] },
      { id: 'T-2', dependsOn: ['T-1'] },
    ],
  })
  assert.equal(validRes.isError, undefined)
  const parsed = JSON.parse(validRes.content[0].text)
  assert.equal(parsed.waveCount, 2)

  const cycleRes = handleMcpToolCall('aoi_os_schedule_dag', {
    nodes: [
      { id: 'T-1', dependsOn: ['T-2'] },
      { id: 'T-2', dependsOn: ['T-1'] },
    ],
  })
  assert.equal(cycleRes.isError, true)
  assert.ok(cycleRes.content[0].text.includes('Cycle detected'))
})

test('handleMcpToolCall executes aoi_os_generate_compliance_report tool', () => {
  const res = handleMcpToolCall('aoi_os_generate_compliance_report', {
    workspace: 'AOI-MCP',
    taskId: 'TASK-1',
    auditResults: [{ pillar: 'Atomic Fsync', safe: true, proof: 'OK' }],
  })
  assert.equal(res.isError, undefined)
  assert.ok(res.content[0].text.includes('AOI-OS Security & Architectural Compliance Report'))
  assert.ok(res.content[0].text.includes('**COMPLIANT**'))
})
