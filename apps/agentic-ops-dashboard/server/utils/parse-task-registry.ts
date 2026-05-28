import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { RegistryFeatureRow, RegistryTaskRow } from '~/shared/types'

function extractTableRows(markdown: string, heading: string): string[][] {
  const lines = markdown.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => line.trim() === `## ${heading}`)

  if (headingIndex === -1) {
    return []
  }

  const tableLines: string[] = []

  for (const line of lines.slice(headingIndex + 1)) {
    if (!line.trim()) {
      if (tableLines.length > 0) {
        break
      }
      continue
    }

    if (!line.trim().startsWith('|')) {
      if (tableLines.length > 0) {
        break
      }
      continue
    }

    tableLines.push(line)
  }

  return tableLines
    .slice(2)
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean))
}

export async function parseTaskRegistry(workspaceRoot: string): Promise<{
  features: RegistryFeatureRow[]
  tasks: RegistryTaskRow[]
}> {
  const registryPath = join(workspaceRoot, '.tasks', 'registry.md')
  const content = await readFile(registryPath, 'utf8')

  const features = extractTableRows(content, 'Features').map<RegistryFeatureRow>((cells) => ({
    slug: cells[0] ?? '',
    status: cells[1] ?? '',
    tasks: Number.parseInt(cells[2] ?? '0', 10) || 0,
    created: cells[3] ?? '',
  }))

  const tasks = extractTableRows(content, 'Tasks').map<RegistryTaskRow>((cells) => ({
    id: cells[0] ?? '',
    feature: cells[1] ?? '',
    title: cells[2] ?? '',
    status: cells[3] ?? '',
    owner: cells[4] ?? '',
    created: cells[5] ?? '',
    closed: cells[6] ? cells[6] : null,
  }))

  return { features, tasks }
}