import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { collectCopilotTokenUsageSummary } from '../../server/utils/token-observability/collect-copilot-token-usage'

const createdDirs: string[] = []

afterEach(async () => {
  await Promise.all(createdDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('collectCopilotTokenUsageSummary', () => {
  it('collects Copilot token usage for the current workspace and writes a local snapshot', async () => {
    const now = Date.parse('2026-06-20T12:00:00.000Z')
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-token-summary-'))
    const workspaceStorageRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-workspace-storage-'))
    createdDirs.push(workspaceRoot, workspaceStorageRoot)

    await mkdir(join(workspaceRoot, '.github', 'prompts'), { recursive: true })
    await writeFile(
      join(workspaceRoot, '.github', 'prompts', 'sdd-new.prompt.md'),
      `---\ndescription: Example\nmode: "agent"\n---\n\nYou are the @supervisor.\n`,
      'utf8',
    )

    const sessionRoot = join(
      workspaceStorageRoot,
      'workspace-a',
      'GitHub.copilot-chat',
      'debug-logs',
      'session-a',
    )
    await mkdir(sessionRoot, { recursive: true })

    const mainLog = [
      JSON.stringify({
        ts: Date.parse('2026-06-20T10:31:44.614Z'),
        sid: 'session-a',
        type: 'hook',
        name: 'SessionStart',
        attrs: {
          input: JSON.stringify({ cwd: workspaceRoot }),
        },
      }),
      JSON.stringify({
        ts: Date.parse('2026-06-20T10:31:44.807Z'),
        sid: 'session-a',
        type: 'user_message',
        attrs: {
          content: '/sdd-new TASK-2026-001 add token observability',
        },
      }),
      JSON.stringify({
        ts: Date.parse('2026-06-20T10:31:44.967Z'),
        sid: 'session-a',
        type: 'llm_request',
        spanId: 'request-1',
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
        ts: Date.parse('2026-06-20T10:31:45.100Z'),
        sid: 'session-a',
        type: 'tool_call',
        name: 'read_file',
      }),
      JSON.stringify({
        ts: Date.parse('2026-06-20T10:31:45.300Z'),
        sid: 'session-a',
        type: 'llm_request',
        spanId: 'request-2',
        attrs: {
          model: 'gpt-5.4',
          inputTokens: 400,
          outputTokens: 40,
          cachedTokens: 0,
          responseId: 'response-2',
          copilotUsageNanoAiu: 1000000,
        },
      }),
    ].join('\n')

    const titleLog = JSON.stringify({
      ts: Date.parse('2026-06-20T10:31:45.400Z'),
      sid: 'session-a-title',
      type: 'llm_request',
      spanId: 'request-3',
      attrs: {
        model: 'gpt-5.4',
        inputTokens: 50,
        outputTokens: 10,
        cachedTokens: 0,
        responseId: 'response-3',
        copilotUsageNanoAiu: 250000,
      },
    })

    await writeFile(join(sessionRoot, 'main.jsonl'), mainLog, 'utf8')
    await writeFile(join(sessionRoot, 'title-123.jsonl'), titleLog, 'utf8')

    const summary = await collectCopilotTokenUsageSummary({
      workspaceRoot,
      workspaceStorageRoots: [workspaceStorageRoot],
      config: {
        enabled: true,
        source: 'copilot',
        maxRecentRequests: 10,
        retentionDays: 30,
        updatedAt: null,
      },
      now,
    })

    expect(summary.status).toBe('ready')
    expect(summary.totals).toMatchObject({
      requestCount: 3,
      inputTokens: 1650,
      outputTokens: 230,
      cachedTokens: 256,
      aiuNano: 6250000,
    })
    expect(summary.byAgent.map((row) => row.key)).toEqual(['supervisor', 'title'])
    expect(summary.byPrompt[0]).toMatchObject({ key: 'sdd-new', requestCount: 2 })
    expect(summary.sources).toMatchObject({
      excludedRequests: 0,
      retentionCutoff: '2026-05-21T12:00:00.000Z',
    })
    expect(summary.byTool).toEqual([
      expect.objectContaining({
        key: 'read_file',
        callCount: 1,
        inputTokens: 400,
        outputTokens: 40,
        confidence: 'estimated',
      }),
    ])
    expect(summary.snapshotPath).toContain('.icm/token-observability/copilot/summary.json')

    if (!summary.snapshotPath) {
      throw new Error('Expected snapshot path to be defined.')
    }

    const snapshot = await readFile(summary.snapshotPath, 'utf8')
    expect(JSON.parse(snapshot)).toMatchObject({
      status: 'ready',
      source: 'copilot',
    })
  })

  it('excludes requests older than the retention window', async () => {
    const now = Date.parse('2026-06-20T12:00:00.000Z')
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-token-retention-'))
    const workspaceStorageRoot = await mkdtemp(join(tmpdir(), 'ops-dashboard-token-storage-'))
    createdDirs.push(workspaceRoot, workspaceStorageRoot)

    const sessionRoot = join(
      workspaceStorageRoot,
      'workspace-b',
      'GitHub.copilot-chat',
      'debug-logs',
      'session-b',
    )
    await mkdir(sessionRoot, { recursive: true })

    const mainLog = [
      JSON.stringify({
        ts: Date.parse('2026-06-20T09:00:00.000Z'),
        sid: 'session-b',
        type: 'hook',
        name: 'SessionStart',
        attrs: {
          input: JSON.stringify({ cwd: workspaceRoot }),
        },
      }),
      JSON.stringify({
        ts: Date.parse('2026-06-20T09:01:00.000Z'),
        sid: 'session-b',
        type: 'llm_request',
        spanId: 'recent-request',
        attrs: {
          model: 'gpt-5.4',
          inputTokens: 200,
          outputTokens: 20,
          cachedTokens: 10,
          responseId: 'recent-response',
        },
      }),
      JSON.stringify({
        ts: Date.parse('2026-05-20T09:01:00.000Z'),
        sid: 'session-b',
        type: 'llm_request',
        spanId: 'expired-request',
        attrs: {
          model: 'gpt-5.4',
          inputTokens: 900,
          outputTokens: 90,
          cachedTokens: 50,
          responseId: 'expired-response',
        },
      }),
    ].join('\n')

    await writeFile(join(sessionRoot, 'main.jsonl'), mainLog, 'utf8')

    const summary = await collectCopilotTokenUsageSummary({
      workspaceRoot,
      workspaceStorageRoots: [workspaceStorageRoot],
      config: {
        enabled: true,
        source: 'copilot',
        maxRecentRequests: 10,
        retentionDays: 7,
        updatedAt: null,
      },
      now,
    })

    expect(summary.status).toBe('ready')
    expect(summary.totals).toMatchObject({
      requestCount: 1,
      inputTokens: 200,
      outputTokens: 20,
      cachedTokens: 10,
    })
    expect(summary.sources).toMatchObject({
      excludedRequests: 1,
      retentionCutoff: '2026-06-13T12:00:00.000Z',
    })
    expect(summary.recentRequests).toHaveLength(1)
    expect(summary.recentRequests[0]?.requestId).toBe('recent-response')
    expect(summary.warnings).toContain(
      'Excluded 1 request(s) older than the 7-day retention window.',
    )
  })
})