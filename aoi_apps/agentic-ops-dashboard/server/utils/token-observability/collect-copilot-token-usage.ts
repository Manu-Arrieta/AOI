import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

import matter from 'gray-matter'

import {
  createDefaultTokenObservabilityConfig,
  createEmptyTokenUsageTotals,
  type TokenObservabilityConfig,
  type TokenUsageAggregateRow,
  type TokenUsageSummary,
  type TokenUsageToolAggregateRow,
} from '~/shared/token-observability'

import { resolveWorkspaceRoot } from '../workspace-root'
import {
  parseCopilotDebugLogJsonl,
  type CopilotTokenRequestRecord,
} from './parse-copilot-debug-log'
import { resolveTokenObservabilityRoot } from './token-observability-config'

interface CollectCopilotTokenUsageOptions {
  workspaceRoot?: string
  workspaceStorageRoots?: string[]
  config?: TokenObservabilityConfig
  persistSnapshot?: boolean
  now?: number
}

const dayMs = 24 * 60 * 60 * 1000

function resolveCandidateWorkspaceStorageRoots(): string[] {
  const envRoots = process.env.AOI_COPILOT_WORKSPACE_STORAGE_ROOTS
  if (envRoots) {
    return envRoots
      .split(delimiter)
      .map((root) => root.trim())
      .filter(Boolean)
  }

  const userHome = homedir()

  switch (process.platform) {
    case 'darwin':
      return [
        join(userHome, 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage'),
        join(userHome, 'Library', 'Application Support', 'Code - Insiders', 'User', 'workspaceStorage'),
      ]
    case 'win32':
      return [
        join(process.env.APPDATA ?? join(userHome, 'AppData', 'Roaming'), 'Code', 'User', 'workspaceStorage'),
        join(process.env.APPDATA ?? join(userHome, 'AppData', 'Roaming'), 'Code - Insiders', 'User', 'workspaceStorage'),
      ]
    default:
      return [
        join(userHome, '.config', 'Code', 'User', 'workspaceStorage'),
        join(userHome, '.config', 'Code - Insiders', 'User', 'workspaceStorage'),
      ]
  }
}

async function loadPromptAgentMap(workspaceRoot: string): Promise<Record<string, string>> {
  const promptsRoot = join(workspaceRoot, '.github', 'prompts')
  if (!existsSync(promptsRoot)) {
    return {}
  }

  const entries = await readdir(promptsRoot, { withFileTypes: true })
  const promptAgentMap: Record<string, string> = {}

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.prompt.md')) {
      continue
    }

    const promptName = entry.name.replace(/\.prompt\.md$/, '')
    const promptPath = join(promptsRoot, entry.name)
    const raw = await readFile(promptPath, 'utf8')
    const parsed = matter(raw)

    const frontmatterAgent = typeof parsed.data.agent === 'string' ? parsed.data.agent : null
    const inlineAgentMatch = /You are the @([a-z0-9._-]+)/i.exec(parsed.content)
    const inlineAgent = inlineAgentMatch?.[1].replace(/[.,:;!?]+$/, '') ?? null
    const resolvedAgent = frontmatterAgent ?? inlineAgent

    if (resolvedAgent) {
      promptAgentMap[promptName] = resolvedAgent
    }
  }

  return promptAgentMap
}

async function discoverSessionDirectories(workspaceStorageRoot: string): Promise<string[]> {
  if (!existsSync(workspaceStorageRoot)) {
    return []
  }

  const workspaceEntries = await readdir(workspaceStorageRoot, { withFileTypes: true })
  const sessionDirectories: string[] = []

  for (const workspaceEntry of workspaceEntries) {
    if (!workspaceEntry.isDirectory()) {
      continue
    }

    const debugLogsRoot = join(
      workspaceStorageRoot,
      workspaceEntry.name,
      'GitHub.copilot-chat',
      'debug-logs',
    )

    if (!existsSync(debugLogsRoot)) {
      continue
    }

    const debugEntries = await readdir(debugLogsRoot, { withFileTypes: true })
    for (const debugEntry of debugEntries) {
      if (debugEntry.isDirectory()) {
        sessionDirectories.push(join(debugLogsRoot, debugEntry.name))
      }
    }
  }

  return sessionDirectories
}

function addRequestTotals(target: TokenUsageAggregateRow, request: CopilotTokenRequestRecord) {
  target.requestCount += 1
  target.inputTokens += request.inputTokens
  target.outputTokens += request.outputTokens
  target.cachedTokens += request.cachedTokens
  target.aiuNano += request.aiuNano ?? 0
}

function sortAggregateRows<T extends TokenUsageAggregateRow>(rows: T[]): T[] {
  return rows.sort((left, right) => {
    const leftTotal = left.inputTokens + left.outputTokens
    const rightTotal = right.inputTokens + right.outputTokens
    if (leftTotal !== rightTotal) {
      return rightTotal - leftTotal
    }
    return left.label.localeCompare(right.label)
  })
}

function createAggregateRow(key: string, label: string): TokenUsageAggregateRow {
  return {
    key,
    label,
    ...createEmptyTokenUsageTotals(),
  }
}

function aggregateRequests(requests: CopilotTokenRequestRecord[]) {
  const totals = createEmptyTokenUsageTotals()
  const byModel = new Map<string, TokenUsageAggregateRow>()
  const byAgent = new Map<string, TokenUsageAggregateRow>()
  const byPrompt = new Map<string, TokenUsageAggregateRow>()
  const byTool = new Map<string, TokenUsageToolAggregateRow>()

  for (const request of requests) {
    totals.requestCount += 1
    totals.inputTokens += request.inputTokens
    totals.outputTokens += request.outputTokens
    totals.cachedTokens += request.cachedTokens
    totals.aiuNano += request.aiuNano ?? 0

    const modelKey = request.model
    const modelRow = byModel.get(modelKey) ?? createAggregateRow(modelKey, modelKey)
    addRequestTotals(modelRow, request)
    byModel.set(modelKey, modelRow)

    const agentKey = request.agentName ?? 'unattributed'
    const agentRow = byAgent.get(agentKey) ?? createAggregateRow(agentKey, request.agentName ?? 'Unattributed')
    addRequestTotals(agentRow, request)
    byAgent.set(agentKey, agentRow)

    const promptKey = request.promptName ?? 'direct-chat'
    const promptRow = byPrompt.get(promptKey) ?? createAggregateRow(promptKey, request.promptName ?? 'Direct chat')
    addRequestTotals(promptRow, request)
    byPrompt.set(promptKey, promptRow)

    for (const tool of request.tools) {
      const toolRow = byTool.get(tool.toolName) ?? {
        key: tool.toolName,
        label: tool.toolName,
        callCount: 0,
        confidence: 'estimated' as const,
        ...createEmptyTokenUsageTotals(),
      }

      toolRow.callCount += tool.callCount
      toolRow.requestCount += 1
      toolRow.inputTokens += tool.estimatedInputTokens
      toolRow.outputTokens += tool.estimatedOutputTokens
      byTool.set(tool.toolName, toolRow)
    }
  }

  return {
    totals,
    byModel: sortAggregateRows([...byModel.values()]),
    byAgent: sortAggregateRows([...byAgent.values()]),
    byPrompt: sortAggregateRows([...byPrompt.values()]),
    byTool: [...byTool.values()].sort((left, right) => {
      const leftTotal = left.inputTokens + left.outputTokens
      const rightTotal = right.inputTokens + right.outputTokens
      if (leftTotal !== rightTotal) {
        return rightTotal - leftTotal
      }
      return left.label.localeCompare(right.label)
    }),
  }
}

function resolveRetentionCutoff(now: number, retentionDays: number): string {
  return new Date(now - (retentionDays * dayMs)).toISOString()
}

function filterRequestsByRetention(
  requests: CopilotTokenRequestRecord[],
  retentionCutoff: string,
): { retainedRequests: CopilotTokenRequestRecord[]; excludedRequests: number } {
  const retainedRequests = requests.filter((request) => request.timestamp >= retentionCutoff)

  return {
    retainedRequests,
    excludedRequests: requests.length - retainedRequests.length,
  }
}

async function collectRequestsFromSessionDirectory(
  sessionDirectory: string,
  workspaceRoot: string,
  promptAgentMap: Record<string, string>,
): Promise<{
  matched: boolean
  requests: CopilotTokenRequestRecord[]
  warnings: string[]
  logFileCount: number
}> {
  const mainLogPath = join(sessionDirectory, 'main.jsonl')
  if (!existsSync(mainLogPath)) {
    return { matched: false, requests: [], warnings: [], logFileCount: 0 }
  }

  const mainContent = await readFile(mainLogPath, 'utf8')
  const parsedMain = parseCopilotDebugLogJsonl(mainContent, {
    workspaceRoot,
    promptAgentMap,
    logFileName: 'main.jsonl',
  })

  if (!parsedMain.matchesWorkspace) {
    return { matched: false, requests: [], warnings: parsedMain.warnings, logFileCount: 1 }
  }

  const requests = [...parsedMain.requests]
  const warnings = [...parsedMain.warnings]

  const entries = await readdir(sessionDirectory, { withFileTypes: true })
  let logFileCount = 1

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl') || entry.name === 'main.jsonl') {
      continue
    }

    const content = await readFile(join(sessionDirectory, entry.name), 'utf8')
    const parsedChild = parseCopilotDebugLogJsonl(content, {
      promptAgentMap,
      logFileName: entry.name,
    })

    requests.push(...parsedChild.requests)
    warnings.push(...parsedChild.warnings)
    logFileCount += 1
  }

  return {
    matched: true,
    requests,
    warnings,
    logFileCount,
  }
}

async function persistSummarySnapshot(workspaceRoot: string, summary: TokenUsageSummary): Promise<string> {
  const snapshotDirectory = join(resolveTokenObservabilityRoot(workspaceRoot), 'copilot')
  await mkdir(snapshotDirectory, { recursive: true })
  const snapshotPath = join(snapshotDirectory, 'summary.json')
  await writeFile(snapshotPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  return snapshotPath
}

export async function collectCopilotTokenUsageSummary(
  options: CollectCopilotTokenUsageOptions = {},
): Promise<TokenUsageSummary> {
  const workspaceRoot = options.workspaceRoot ?? resolveWorkspaceRoot()
  const config = options.config ?? createDefaultTokenObservabilityConfig()
  const now = options.now ?? Date.now()
  const workspaceStorageRoots = (options.workspaceStorageRoots ?? resolveCandidateWorkspaceStorageRoots())
    .filter((root, index, all) => all.indexOf(root) === index)
    .filter((root) => existsSync(root))

  if (!config.enabled) {
    return {
      status: 'disabled',
      source: 'copilot',
      generatedAt: new Date().toISOString(),
      config,
      sources: {
        workspaceStorageRoots,
        scannedSessions: 0,
        scannedLogFiles: 0,
        retentionCutoff: null,
        excludedRequests: 0,
      },
      totals: createEmptyTokenUsageTotals(),
      byModel: [],
      byAgent: [],
      byPrompt: [],
      byTool: [],
      recentRequests: [],
      warnings: [],
      snapshotPath: null,
    }
  }

  const promptAgentMap = await loadPromptAgentMap(workspaceRoot)
  const warnings: string[] = []
  const requests: CopilotTokenRequestRecord[] = []
  let scannedSessions = 0
  let scannedLogFiles = 0

  for (const workspaceStorageRoot of workspaceStorageRoots) {
    const sessionDirectories = await discoverSessionDirectories(workspaceStorageRoot)

    for (const sessionDirectory of sessionDirectories) {
      scannedSessions += 1
      const parsed = await collectRequestsFromSessionDirectory(sessionDirectory, workspaceRoot, promptAgentMap)
      scannedLogFiles += parsed.logFileCount
      warnings.push(...parsed.warnings)

      if (parsed.matched) {
        requests.push(...parsed.requests)
      }
    }
  }

  const retentionCutoff = resolveRetentionCutoff(now, config.retentionDays)
  const { retainedRequests, excludedRequests } = filterRequestsByRetention(requests, retentionCutoff)

  if (excludedRequests > 0) {
    warnings.push(
      `Excluded ${excludedRequests} request(s) older than the ${config.retentionDays}-day retention window.`,
    )
  }

  const aggregates = aggregateRequests(retainedRequests)
  const status = workspaceStorageRoots.length === 0 || retainedRequests.length === 0 ? 'missing-source' : 'ready'
  const summary: TokenUsageSummary = {
    status,
    source: 'copilot',
    generatedAt: new Date(now).toISOString(),
    config,
    sources: {
      workspaceStorageRoots,
      scannedSessions,
      scannedLogFiles,
      retentionCutoff,
      excludedRequests,
    },
    totals: aggregates.totals,
    byModel: aggregates.byModel,
    byAgent: aggregates.byAgent,
    byPrompt: aggregates.byPrompt,
    byTool: aggregates.byTool,
    recentRequests: [...retainedRequests]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, config.maxRecentRequests),
    warnings,
    snapshotPath: null,
  }

  if (options.persistSnapshot ?? true) {
    summary.snapshotPath = await persistSummarySnapshot(workspaceRoot, summary)
  }

  return summary
}