import { existsSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

import type {
  ArtifactRecord,
  RegistryTaskRow,
  ResourceTreeNode,
  TaskRecord,
  WorkspaceSnapshot,
} from '~/shared/types'

import { loadTaskRelations } from './load-task-relations'
import { parseTaskRegistry } from './parse-task-registry'
import { resolveWorkspaceName, resolveWorkspaceRoot } from './workspace-root'

const previewableExtensions = new Set(['.json', '.md', '.txt', '.yml', '.yaml'])
const taskArtifactGenerationOrder = new Map<string, number>([
  ['context.md', 0],
  ['proposal.md', 10],
  ['requirement.md', 20],
  ['spec.md', 30],
  ['design.md', 40],
  ['tasks.md', 50],
  ['implementation-plan.md', 60],
  ['relations.json', 70],
  ['iterations', 80],
  ['verify-report.md', 90],
  ['functional-docs.md', 100],
  ['archive-report.md', 110],
])

function compareTaskArtifacts(left: Dirent, right: Dirent): number {
  const leftRank = taskArtifactGenerationOrder.get(left.name) ?? 75
  const rightRank = taskArtifactGenerationOrder.get(right.name) ?? 75

  if (leftRank !== rightRank) {
    return leftRank - rightRank
  }

  return left.name.localeCompare(right.name)
}

async function readArtifactPreview(absolutePath: string, extension: string | null): Promise<string | null> {
  if (!extension || !previewableExtensions.has(extension)) {
    return null
  }

  const fileStat = await stat(absolutePath)
  if (fileStat.size > 24_000) {
    return null
  }

  const raw = await readFile(absolutePath, 'utf8')
  return raw.slice(0, 6000)
}

async function listTaskArtifacts(workspaceRoot: string, taskDirectory: string): Promise<ArtifactRecord[]> {
  if (!existsSync(taskDirectory)) {
    return []
  }

  const entries = await readdir(taskDirectory, { withFileTypes: true })
  const artifacts: ArtifactRecord[] = []

  // Keep the artifact list aligned with the canonical SDD generation flow.
  for (const entry of entries.sort(compareTaskArtifacts)) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const absolutePath = join(taskDirectory, entry.name)
    const relativePath = relative(workspaceRoot, absolutePath).replaceAll('\\', '/')

    if (entry.isDirectory()) {
      artifacts.push({
        name: entry.name,
        path: relativePath,
        kind: 'directory',
        extension: null,
        size: null,
        preview: null,
      })
      continue
    }

    const fileStat = await stat(absolutePath)
    const extension = extname(entry.name) || null
    artifacts.push({
      name: entry.name,
      path: relativePath,
      kind: 'file',
      extension,
      size: fileStat.size,
      preview: await readArtifactPreview(absolutePath, extension),
    })
  }

  return artifacts
}

async function buildResourcesTree(rootDirectory: string, relativePath = '.resources'): Promise<ResourceTreeNode[]> {
  if (!existsSync(rootDirectory)) {
    return []
  }

  const entries = await readdir(rootDirectory, { withFileTypes: true })
  const nodes: ResourceTreeNode[] = []

  for (const entry of entries.sort((left, right) => {
    if (left.isDirectory() && !right.isDirectory()) {
      return -1
    }
    if (!left.isDirectory() && right.isDirectory()) {
      return 1
    }
    return left.name.localeCompare(right.name)
  })) {
    if (entry.name === '.DS_Store') {
      continue
    }

    const nodePath = `${relativePath}/${entry.name}`
    const absolutePath = join(rootDirectory, entry.name)

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: nodePath,
        kind: 'directory',
        children: await buildResourcesTree(absolutePath, nodePath),
      })
      continue
    }

    nodes.push({
      name: entry.name,
      path: nodePath,
      kind: 'file',
    })
  }

  return nodes
}

async function buildTaskRecord(workspaceRoot: string, task: RegistryTaskRow): Promise<TaskRecord> {
  const taskDirectory = join(workspaceRoot, '.tasks', task.feature, task.id)
  const warnings: string[] = []

  if (!existsSync(taskDirectory)) {
    warnings.push(`Task directory missing: .tasks/${task.feature}/${task.id}`)
  }

  const artifacts = await listTaskArtifacts(workspaceRoot, taskDirectory)
  const relations = await loadTaskRelations(workspaceRoot, taskDirectory)

  return {
    ...task,
    directoryPath: `.tasks/${task.feature}/${task.id}`,
    artifacts,
    relations: relations.relations,
    relationReferences: relations.relationReferences,
    warnings: [...warnings, ...relations.warnings],
  }
}

export async function buildWorkspaceSnapshot(workspaceRoot = resolveWorkspaceRoot()): Promise<WorkspaceSnapshot> {
  const workspaceName = resolveWorkspaceName(workspaceRoot)
  const registry = await parseTaskRegistry(workspaceRoot)
  const tasks = await Promise.all(registry.tasks.map((task) => buildTaskRecord(workspaceRoot, task)))
  const resources = await buildResourcesTree(join(workspaceRoot, '.resources'))

  const warnings = tasks.flatMap((task) => task.warnings)
  const activeTasks = tasks.filter((task) => !['📦 Archivado', '❌ Cancelado'].includes(task.status)).length

  return {
    workspaceName,
    generatedAt: new Date().toISOString(),
    features: registry.features,
    tasks,
    resources,
    warnings,
    counts: {
      features: registry.features.length,
      tasks: tasks.length,
      activeTasks,
    },
  }
}