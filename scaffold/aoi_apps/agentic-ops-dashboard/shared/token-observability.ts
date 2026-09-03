import { z } from 'zod'

import type { CopilotTokenRequestRecord } from '../server/utils/token-observability/parse-copilot-debug-log'

export const tokenObservabilityConfigSchema = z.object({
  enabled: z.boolean().default(false),
  source: z.literal('copilot').default('copilot'),
  maxRecentRequests: z.number().int().positive().default(50),
  retentionDays: z.number().int().positive().default(30),
  updatedAt: z.iso.datetime().nullable().default(null),
})

export type TokenObservabilityConfig = z.infer<typeof tokenObservabilityConfigSchema>

export interface TokenUsageTotals {
  requestCount: number
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  aiuNano: number
}

export interface TokenUsageAggregateRow extends TokenUsageTotals {
  key: string
  label: string
}

export interface TokenUsageToolAggregateRow extends TokenUsageAggregateRow {
  callCount: number
  confidence: 'estimated'
}

export interface TokenUsageSourceSnapshot {
  workspaceStorageRoots: string[]
  scannedSessions: number
  scannedLogFiles: number
  retentionCutoff: string | null
  excludedRequests: number
}

export interface TokenUsageSummary {
  status: 'disabled' | 'ready' | 'missing-source'
  source: 'copilot'
  generatedAt: string
  config: TokenObservabilityConfig
  sources: TokenUsageSourceSnapshot
  totals: TokenUsageTotals
  byModel: TokenUsageAggregateRow[]
  byAgent: TokenUsageAggregateRow[]
  byPrompt: TokenUsageAggregateRow[]
  byTask: TokenUsageAggregateRow[]
  byTool: TokenUsageToolAggregateRow[]
  recentRequests: CopilotTokenRequestRecord[]
  warnings: string[]
  snapshotPath: string | null
}

export function createDefaultTokenObservabilityConfig(): TokenObservabilityConfig {
  return {
    enabled: false,
    source: 'copilot',
    maxRecentRequests: 50,
    retentionDays: 30,
    updatedAt: null,
  }
}

export function createEmptyTokenUsageTotals(): TokenUsageTotals {
  return {
    requestCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedTokens: 0,
    aiuNano: 0,
  }
}