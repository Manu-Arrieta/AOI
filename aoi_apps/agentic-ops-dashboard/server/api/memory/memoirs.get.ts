import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineEventHandler, getQuery } from 'h3'
import { resolveWorkspaceName, resolveWorkspaceRoot } from '../../utils/workspace-root'

const execFileAsync = promisify(execFile)

export interface MemoirConcept {
  id: string
  name: string
  category: string
  summary: string
  dependencies: string[]
  tags: string[]
}

export function parseMemoirConcepts(stdout: string): MemoirConcept[] {
  const concepts: MemoirConcept[] = []
  if (!stdout) return concepts

  // Split on markdown headings or Concept: blocks with optional whitespace
  const rawSections = stdout.split(/\n\s*(?=###? |\bConcept: )/)
  for (const sec of rawSections) {
    const lines = sec
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length === 0) continue

    const firstLine = lines[0]
    if (!firstLine.startsWith('#') && !firstLine.startsWith('Concept:')) continue

    const titleLine = firstLine.replace(/^###?\s*/, '').replace(/^Concept:\s*/, '').trim()
    if (!titleLine) continue

    let summary = ''
    const dependencies: string[] = []
    const tags: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.toLowerCase().startsWith('dependencies:') || line.toLowerCase().startsWith('deps:')) {
        const deps = line.split(':')[1]?.split(',').map((d) => d.trim()).filter(Boolean) || []
        dependencies.push(...deps)
      } else if (line.toLowerCase().startsWith('tags:') || line.toLowerCase().startsWith('keywords:')) {
        const t = line.split(':')[1]?.split(',').map((tag) => tag.trim()).filter(Boolean) || []
        tags.push(...t)
      } else if (!summary && line && !line.startsWith('-')) {
        summary = line
      }
    }

    concepts.push({
      id: titleLine.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: titleLine,
      category: tags[0] || 'architecture',
      summary: summary || 'Architecture concept registered in ICM memoir',
      dependencies,
      tags: tags.length > 0 ? tags : ['architecture', 'icm'],
    })
  }

  return concepts
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceRoot = resolveWorkspaceRoot()
  const workspaceName = resolveWorkspaceName(workspaceRoot)
  const memoirName = (query.memoir as string) || `${workspaceName}-architecture`

  try {
    const { stdout } = await execFileAsync('icm', ['memoir', 'show', memoirName])
    let concepts = parseMemoirConcepts(stdout)

    // Fallback baseline concepts if memoir is currently empty
    if (concepts.length === 0) {
      concepts = [
        {
          id: 'base-project-map',
          name: 'BaseProjectMap',
          category: 'Architecture',
          summary: 'Root architecture topology and entry points for frontend, backend, and shared libraries.',
          dependencies: ['agentic-ops-dashboard', 'spatiotemporal-runtime'],
          tags: ['architecture', 'entrypoints', 'core'],
        },
        {
          id: 'sdd-lifecycle',
          name: 'SDD Lifecycle Engine',
          category: 'Process',
          summary: 'Spec-Driven Development lifecycle (explore, propose, plan, apply, verify, archive).',
          dependencies: ['icm-memory', 'mechanical-verify'],
          tags: ['lifecycle', 'governance', 'quality-gates'],
        },
        {
          id: 'icm-memory-engine',
          name: 'ICM Memory Engine (v4)',
          category: 'Substrate',
          summary: '5-Method persistent memory substrate: Memories, Memoirs, Facts, Feedback, Transcripts.',
          dependencies: [],
          tags: ['memory', 'sqlite', 'facts', 'briefings'],
        },
        {
          id: 'aoi-doctor',
          name: 'AOI Doctor Diagnostic Guard',
          category: 'Governance',
          summary: '360° Deterministic Workspace Health Checker (0ms, 0 tokens).',
          dependencies: ['icm-memory-engine', 'scaffold-mirror'],
          tags: ['doctor', 'diagnostics', 'health'],
        },
      ]
    }

    return {
      success: true,
      workspace: workspaceName,
      memoir: memoirName,
      totalConcepts: concepts.length,
      concepts,
    }
  } catch (error: any) {
    return {
      success: true,
      workspace: workspaceName,
      memoir: memoirName,
      totalConcepts: 0,
      concepts: [],
      note: error.message || 'ICM memoir query unavailable',
    }
  }
})
