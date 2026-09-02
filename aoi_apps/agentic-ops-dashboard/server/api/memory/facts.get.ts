import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineEventHandler, getQuery } from 'h3'
import { resolveWorkspaceName, resolveWorkspaceRoot } from '../../utils/workspace-root'

const execFileAsync = promisify(execFile)

export interface FactItem {
  entity: string
  key: string
  value: string
  namespace: string
}

export function parseFactsOutput(stdout: string, defaultEntity: string): FactItem[] {
  const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  const facts: FactItem[] = []

  for (const line of lines) {
    // Expected formats:
    // 1. "entity.key = value" or "key = value"
    // 2. "entity : key : value"
    // 3. "key: value"
    let entity = defaultEntity
    let key = ''
    let value = ''

    if (line.includes('=')) {
      const [left, ...rest] = line.split('=')
      const right = rest.join('=').trim()
      const parts = left.trim().split('.')
      if (parts.length > 1) {
        entity = parts[0]
        key = parts.slice(1).join('.')
      } else {
        key = parts[0]
      }
      value = right
    } else if (line.includes(':')) {
      const [left, ...rest] = line.split(':')
      key = left.trim()
      value = rest.join(':').trim()
    } else {
      key = line
      value = ''
    }

    if (key) {
      const namespace = key.includes('.') ? key.split('.')[0] : 'general'
      facts.push({ entity, key, value, namespace })
    }
  }

  return facts
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceRoot = resolveWorkspaceRoot()
  const workspaceName = resolveWorkspaceName(workspaceRoot)
  const targetEntity = (query.entity as string) || workspaceName

  try {
    const { stdout } = await execFileAsync('icm', ['facts', 'list', targetEntity])
    const facts = parseFactsOutput(stdout, targetEntity)

    return {
      success: true,
      workspace: workspaceName,
      entity: targetEntity,
      totalFacts: facts.length,
      facts,
    }
  } catch (error: any) {
    // If icm facts list returns empty or non-zero, return empty list cleanly
    return {
      success: true,
      workspace: workspaceName,
      entity: targetEntity,
      totalFacts: 0,
      facts: [],
      note: error.message || 'No facts found or icm CLI unavailable',
    }
  }
})
