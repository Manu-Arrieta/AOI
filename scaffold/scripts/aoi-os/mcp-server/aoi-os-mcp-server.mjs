/**
 * scripts/aoi-os/mcp-server/aoi-os-mcp-server.mjs
 *
 * Model Context Protocol (MCP) Server for AOI-OS:
 * Exposes AOI-OS deterministic invariant verification, AST structural analysis,
 * DAG wave scheduling, and compliance reporting tools via standard JSON-RPC (0 LLM Tokens).
 */

import { analyzeAstStructure } from '../ast-guard/ast-structural-analyzer.mjs'
import { validateDagStructure, computeExecutionBatches } from '../dag-engine/dag-scheduler.mjs'
import { generateComplianceReport } from '../reporting/compliance-report-generator.mjs'

export const AOI_OS_MCP_TOOLS = [
  {
    name: 'aoi_os_analyze_ast',
    description: 'Performs deterministic AST lexical analysis, verifying balanced delimiters and extracting declarations.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceCode: { type: 'string', description: 'JavaScript/TypeScript source code to analyze' },
      },
      required: ['sourceCode'],
    },
  },
  {
    name: 'aoi_os_schedule_dag',
    description: 'Validates DAG structure, detects cycles, and calculates parallel execution waves.',
    inputSchema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              dependsOn: { type: 'array', items: { type: 'string' } },
            },
            required: ['id'],
          },
        },
      },
      required: ['nodes'],
    },
  },
  {
    name: 'aoi_os_generate_compliance_report',
    description: 'Aggregates audit invariant results into a structured compliance report.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace: { type: 'string' },
        taskId: { type: 'string' },
        auditResults: { type: 'array', items: { type: 'object' } },
      },
      required: ['auditResults'],
    },
  },
]

/**
 * Handles an incoming MCP JSON-RPC tool invocation request.
 *
 * @param {string} toolName
 * @param {object} args
 * @returns {object} Tool execution response
 */
export function handleMcpToolCall(toolName, args = {}) {
  switch (toolName) {
    case 'aoi_os_analyze_ast': {
      const result = analyzeAstStructure(args.sourceCode || '')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    }
    case 'aoi_os_schedule_dag': {
      const nodes = (args.nodes || []).map((n) => ({
        ...n,
        dependsOn: Array.isArray(n.dependsOn) ? n.dependsOn : [],
        status: n.status || 'pending',
      }))
      const validation = validateDagStructure(nodes)
      if (!validation.valid) {
        return {
          isError: true,
          content: [{ type: 'text', text: `DAG validation error: ${validation.errors.join('; ')}` }],
        }
      }
      const batches = computeExecutionBatches(nodes)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ valid: true, waveCount: batches.length, batches }, null, 2),
          },
        ],
      }
    }
    case 'aoi_os_generate_compliance_report': {
      const report = generateComplianceReport({
        workspace: args.workspace || 'AOI',
        taskId: args.taskId || 'MCP-TASK',
        auditResults: args.auditResults || [],
      })
      return {
        content: [
          {
            type: 'text',
            text: report.toMarkdown(),
          },
        ],
      }
    }
    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown MCP tool: ${toolName}` }],
      }
  }
}
