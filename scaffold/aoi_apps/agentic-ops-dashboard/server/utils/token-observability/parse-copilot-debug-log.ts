import { basename } from 'node:path'

export type TokenAttributionConfidence = 'none' | 'derived' | 'estimated'

export interface CopilotToolAttribution {
  toolName: string
  callCount: number
  estimatedInputTokens: number
  estimatedOutputTokens: number
  confidence: Extract<TokenAttributionConfidence, 'estimated'>
}

export interface CopilotTokenRequestRecord {
  requestId: string
  sessionId: string
  sourceLabel: string
  timestamp: string
  model: string
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  aiuNano: number | null
  durationMs: number | null
  promptName: string | null
  promptConfidence: Exclude<TokenAttributionConfidence, 'estimated'>
  agentName: string | null
  agentConfidence: Exclude<TokenAttributionConfidence, 'estimated'>
  taskId: string | null
  tools: CopilotToolAttribution[]
}

export interface ParsedCopilotDebugLog {
  matchesWorkspace: boolean
  workspaceRoot: string | null
  requests: CopilotTokenRequestRecord[]
  warnings: string[]
}

export interface ParseCopilotDebugLogOptions {
  workspaceRoot?: string
  promptAgentMap?: Record<string, string>
  logFileName?: string
}

interface RawCopilotEvent {
  ts?: number
  sid?: string
  type?: string
  name?: string
  dur?: number
  spanId?: string
  attrs?: Record<string, unknown>
}

interface RequestContext {
  promptName: string | null
  agentMention: string | null
  taskId: string | null
  pendingTools: string[]
}

const taskIdPattern = /\bTASK-\d{4}-\d{3}\b/
const slashCommandPattern = /^\/([a-z0-9._-]+)/i
const agentMentionPattern = /(?:^|\s)@([a-z0-9._-]+)/i

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function extractHookInput(attrs: Record<string, unknown>): Record<string, unknown> | null {
  const rawInput = asString(attrs.input)
  if (!rawInput) {
    return null
  }

  try {
    return asRecord(JSON.parse(rawInput))
  } catch {
    return null
  }
}

function extractWorkspaceRootCandidate(event: RawCopilotEvent): string | null {
  const attrs = asRecord(event.attrs)
  if (!attrs) {
    return null
  }

  const directCwd = asString(attrs.cwd)
  if (directCwd) {
    return directCwd
  }

  const hookInput = extractHookInput(attrs)
  return hookInput ? asString(hookInput.cwd) : null
}

function derivePromptName(message: string): string | null {
  const trimmed = message.trim()
  const match = slashCommandPattern.exec(trimmed)
  return match?.[1] ?? null
}

function deriveAgentMention(message: string): string | null {
  const match = agentMentionPattern.exec(message)
  return match?.[1] ?? null
}

function deriveTaskId(message: string): string | null {
  const match = taskIdPattern.exec(message)
  return match?.[0] ?? null
}

function deriveChildSessionAgentName(logFileName: string | undefined): string | null {
  if (!logFileName || logFileName === 'main.jsonl') {
    return null
  }

  const fileStem = basename(logFileName, '.jsonl')
  const separatorIndex = fileStem.indexOf('-')
  if (separatorIndex <= 0) {
    return fileStem || null
  }

  return fileStem.slice(0, separatorIndex) || null
}

function buildToolAttribution(
  pendingTools: string[],
  inputTokens: number,
  outputTokens: number,
): CopilotToolAttribution[] {
  if (!pendingTools.length) {
    return []
  }

  const totalCalls = pendingTools.length
  const grouped = new Map<string, number>()

  for (const toolName of pendingTools) {
    grouped.set(toolName, (grouped.get(toolName) ?? 0) + 1)
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([toolName, callCount]) => {
      const weight = callCount / totalCalls
      return {
        toolName,
        callCount,
        estimatedInputTokens: Math.round(inputTokens * weight),
        estimatedOutputTokens: Math.round(outputTokens * weight),
        confidence: 'estimated' as const,
      }
    })
}

function parseJsonlEvents(content: string): { events: RawCopilotEvent[]; warnings: string[] } {
  const warnings: string[] = []
  const events: RawCopilotEvent[] = []

  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue
    }

    try {
      events.push(JSON.parse(line) as RawCopilotEvent)
    } catch {
      warnings.push(`Skipped invalid JSONL line ${index + 1}.`)
    }
  }

  return { events, warnings }
}

function detectWorkspaceRoot(events: RawCopilotEvent[]): string | null {
  for (const event of events) {
    const candidate = extractWorkspaceRootCandidate(event)
    if (candidate) {
      return candidate
    }
  }

  return null
}

function createRequestContext(): RequestContext {
  return {
    promptName: null,
    agentMention: null,
    taskId: null,
    pendingTools: [],
  }
}

function applyUserMessage(contentText: string, context: RequestContext) {
  context.promptName = derivePromptName(contentText)
  context.agentMention = deriveAgentMention(contentText)
  context.taskId = deriveTaskId(contentText)
  context.pendingTools = []
}

function captureContextEvent(event: RawCopilotEvent, context: RequestContext): boolean {
  const attrs = asRecord(event.attrs)

  if (event.type === 'user_message') {
    const contentText = attrs ? asString(attrs.content) : null
    if (contentText) {
      applyUserMessage(contentText, context)
    }

    return true
  }

  if (event.type === 'tool_call' && event.name) {
    context.pendingTools.push(event.name)
    return true
  }

  return false
}

function resolvePromptMetadata(
  context: RequestContext,
  options: ParseCopilotDebugLogOptions,
  fallbackAgentName: string | null,
) {
  const promptName = context.promptName
  const promptConfidence = promptName ? 'derived' as const : 'none' as const
  const mappedAgentName = promptName ? options.promptAgentMap?.[promptName] ?? null : null
  const agentName = mappedAgentName ?? context.agentMention ?? fallbackAgentName

  return {
    promptName,
    promptConfidence,
    agentName,
    agentConfidence: agentName ? 'derived' as const : 'none' as const,
  }
}

function buildRequestRecord(
  event: RawCopilotEvent,
  options: ParseCopilotDebugLogOptions,
  context: RequestContext,
  fallbackAgentName: string | null,
  warnings: string[],
  requestIndex: number,
): CopilotTokenRequestRecord | null {
  const attrs = asRecord(event.attrs)
  if (event.type !== 'llm_request' || !attrs) {
    return null
  }

  const inputTokens = asNumber(attrs.inputTokens)
  const outputTokens = asNumber(attrs.outputTokens)
  const model = asString(attrs.model)

  if (inputTokens === null || outputTokens === null || !model) {
    warnings.push(`Skipped llm_request without token metrics for span ${event.spanId ?? 'unknown'}.`)
    context.pendingTools = []
    return null
  }

  const metadata = resolvePromptMetadata(context, options, fallbackAgentName)
  const record: CopilotTokenRequestRecord = {
    requestId: asString(attrs.responseId) ?? event.spanId ?? `${event.sid ?? 'session'}:${requestIndex}`,
    sessionId: event.sid ?? 'unknown',
    sourceLabel: options.logFileName ?? 'main.jsonl',
    timestamp: event.ts ? new Date(event.ts).toISOString() : new Date(0).toISOString(),
    model,
    inputTokens,
    outputTokens,
    cachedTokens: asNumber(attrs.cachedTokens) ?? 0,
    aiuNano: asNumber(attrs.copilotUsageNanoAiu),
    durationMs: typeof event.dur === 'number' ? event.dur : null,
    promptName: metadata.promptName,
    promptConfidence: metadata.promptConfidence,
    agentName: metadata.agentName,
    agentConfidence: metadata.agentConfidence,
    taskId: context.taskId,
    tools: buildToolAttribution(context.pendingTools, inputTokens, outputTokens),
  }

  context.pendingTools = []
  return record
}

export function parseCopilotDebugLogJsonl(
  content: string,
  options: ParseCopilotDebugLogOptions = {},
): ParsedCopilotDebugLog {
  const { events, warnings } = parseJsonlEvents(content)
  const detectedWorkspaceRoot = detectWorkspaceRoot(events)

  const matchesWorkspace = options.workspaceRoot
    ? detectedWorkspaceRoot === options.workspaceRoot
    : true

  if (!matchesWorkspace) {
    return {
      matchesWorkspace,
      workspaceRoot: detectedWorkspaceRoot,
      requests: [],
      warnings,
    }
  }

  const context = createRequestContext()
  const fallbackAgentName = deriveChildSessionAgentName(options.logFileName)
  const requests: CopilotTokenRequestRecord[] = []

  for (const event of events) {
    if (captureContextEvent(event, context)) {
      continue
    }

    const record = buildRequestRecord(event, options, context, fallbackAgentName, warnings, requests.length)
    if (record) {
      requests.push(record)
    }
  }

  return {
    matchesWorkspace,
    workspaceRoot: detectedWorkspaceRoot,
    requests,
    warnings,
  }
}