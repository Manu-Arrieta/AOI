import { describe, expect, it } from 'vitest'

import { parseCopilotDebugLogJsonl } from '../../server/utils/token-observability/parse-copilot-debug-log'

describe('parseCopilotDebugLogJsonl', () => {
  it('extracts exact request tokens and derives prompt, agent, task, and tool attribution', () => {
    const workspaceRoot = 'workspace:aoi'
    const content = [
      JSON.stringify({
        ts: 1781961104614,
        sid: 'session-1',
        type: 'hook',
        name: 'SessionStart',
        attrs: {
          input: JSON.stringify({ cwd: workspaceRoot }),
        },
      }),
      JSON.stringify({
        ts: 1781961104807,
        sid: 'session-1',
        type: 'user_message',
        attrs: {
          content: '/sdd-new TASK-2026-001 add token observability',
        },
      }),
      JSON.stringify({
        ts: 1781961104967,
        sid: 'session-1',
        type: 'llm_request',
        spanId: 'request-1',
        dur: 3200,
        attrs: {
          model: 'gpt-5.4',
          inputTokens: 1200,
          outputTokens: 180,
          cachedTokens: 256,
          responseId: 'response-1',
          copilotUsageNanoAiu: 5000000,
        },
      }),
      JSON.stringify({
        ts: 1781961105100,
        sid: 'session-1',
        type: 'tool_call',
        name: 'read_file',
      }),
      JSON.stringify({
        ts: 1781961105200,
        sid: 'session-1',
        type: 'tool_call',
        name: 'run_in_terminal',
      }),
      JSON.stringify({
        ts: 1781961105300,
        sid: 'session-1',
        type: 'llm_request',
        spanId: 'request-2',
        dur: 2100,
        attrs: {
          model: 'gpt-5.4',
          inputTokens: 600,
          outputTokens: 60,
          cachedTokens: 128,
          responseId: 'response-2',
          copilotUsageNanoAiu: 2500000,
        },
      }),
    ].join('\n')

    const parsed = parseCopilotDebugLogJsonl(content, {
      workspaceRoot,
      promptAgentMap: {
        'sdd-new': 'supervisor',
      },
    })

    expect(parsed.matchesWorkspace).toBe(true)
    expect(parsed.requests).toHaveLength(2)

    expect(parsed.requests[0]).toMatchObject({
      requestId: 'response-1',
      promptName: 'sdd-new',
      promptConfidence: 'derived',
      agentName: 'supervisor',
      agentConfidence: 'derived',
      taskId: 'TASK-2026-001',
      inputTokens: 1200,
      outputTokens: 180,
      cachedTokens: 256,
      aiuNano: 5000000,
      tools: [],
    })

    expect(parsed.requests[1]?.tools).toEqual([
      {
        toolName: 'read_file',
        callCount: 1,
        estimatedInputTokens: 300,
        estimatedOutputTokens: 30,
        confidence: 'estimated',
      },
      {
        toolName: 'run_in_terminal',
        callCount: 1,
        estimatedInputTokens: 300,
        estimatedOutputTokens: 30,
        confidence: 'estimated',
      },
    ])
  })

  it('skips logs that belong to another workspace', () => {
    const otherWorkspaceRoot = 'workspace:other'
    const content = JSON.stringify({
      ts: 1781961104614,
      sid: 'session-2',
      type: 'hook',
      name: 'SessionStart',
      attrs: {
        input: JSON.stringify({ cwd: otherWorkspaceRoot }),
      },
    })

    const parsed = parseCopilotDebugLogJsonl(content, {
      workspaceRoot: 'workspace:aoi',
    })

    expect(parsed.matchesWorkspace).toBe(false)
    expect(parsed.requests).toHaveLength(0)
    expect(parsed.workspaceRoot).toBe(otherWorkspaceRoot)
  })
})