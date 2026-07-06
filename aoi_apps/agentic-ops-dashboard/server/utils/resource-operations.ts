import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { promisify } from 'node:util'

import { z } from 'zod'

import { resolveWorkspaceRoot } from './workspace-root'

const execFileAsync = promisify(execFile)
const constitutionMarkerStart = '<!-- managed-folders:start -->'
const constitutionMarkerEnd = '<!-- managed-folders:end -->'
const protectedFolders = new Set(['.resources', '.resources/userstories', '.resources/workflows'])

const createPayloadSchema = z.object({
  folderName: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentPath: z.string().min(1).default('.resources'),
  purpose: z.string().min(1),
})

const movePayloadSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
  reason: z.string().min(1),
})

const deletePayloadSchema = z.object({
  targetPath: z.string().min(1),
  reason: z.string().min(1),
  confirmed: z.literal(true),
})

export type PersistResourceChange = (content: string, keywords: string[]) => Promise<void>

export class ResourceOperationError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
  ) {
    super(message)
    this.name = 'ResourceOperationError'
  }
}

function normalizeRelativePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/\/$/, '')
}

function resolveResourcePath(workspaceRoot: string, inputPath: string): { absolutePath: string; relativePath: string } {
  const normalized = normalizeRelativePath(inputPath)
  const resourcesRoot = resolve(workspaceRoot, '.resources')
  const absolutePath = resolve(workspaceRoot, normalized)

  if (!absolutePath.startsWith(resourcesRoot)) {
    throw new ResourceOperationError('Resource operations must stay inside .resources.', 403)
  }

  return {
    absolutePath,
    relativePath: normalizeRelativePath(relative(workspaceRoot, absolutePath)),
  }
}

function assertFolderMutationAllowed(relativePath: string) {
  if (relativePath === '.resources/constitution.md') {
    throw new ResourceOperationError('constitution.md cannot be mutated by resource folder operations.', 403)
  }

  if (protectedFolders.has(relativePath)) {
    throw new ResourceOperationError('Default managed folders cannot be moved or deleted.', 403)
  }
}

function parseManagedFolderEntries(constitution: string): Map<string, string> {
  const match = new RegExp(
    String.raw`${constitutionMarkerStart}([\s\S]*?)${constitutionMarkerEnd}`,
  ).exec(constitution)

  if (!match) {
    return new Map()
  }

  return new Map(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- `'))
      .map((line) => {
        const normalizedLine = line.slice(2)
        const [pathPart, descriptionPart] = normalizedLine.split('` — ')
        return [pathPart.replaceAll('`', '').replace(/\/$/, ''), descriptionPart ?? '']
      }),
  )
}

function renderManagedFolderEntries(entries: Map<string, string>): string {
  if (entries.size === 0) {
    return `${constitutionMarkerStart}\n- None\n${constitutionMarkerEnd}`
  }

  const lines = [...entries.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, description]) => `- \`${path}/\` — ${description}`)

  return `${constitutionMarkerStart}\n${lines.join('\n')}\n${constitutionMarkerEnd}`
}

async function updateResourcesConstitution(
  workspaceRoot: string,
  mutateEntries: (entries: Map<string, string>) => void,
) {
  const constitutionPath = join(workspaceRoot, '.resources', 'constitution.md')
  const current = await readFile(constitutionPath, 'utf8')
  const entries = parseManagedFolderEntries(current)
  mutateEntries(entries)

  const renderedEntries = renderManagedFolderEntries(entries)
  const blockRegex = new RegExp(String.raw`${constitutionMarkerStart}[\s\S]*?${constitutionMarkerEnd}`)

  const next = blockRegex.test(current)
    ? current.replace(blockRegex, renderedEntries)
    : `${current.trimEnd()}\n\n## Managed Additional Folders\n\n${renderedEntries}\n`

  await writeFile(constitutionPath, next, 'utf8')
}

async function persistResourceOperation(workspaceRoot: string, content: string, keywords: string[]) {
  const topic = `${basename(workspaceRoot)}-context`

  try {
    await execFileAsync('icm', ['store', '-t', topic, '-c', content, '-i', 'high', '-k', keywords.join(',')])
  } catch {
    throw new ResourceOperationError('ICM is unavailable, so the governed operation cannot be persisted.', 500)
  }
}

function defaultPersistor(workspaceRoot: string): PersistResourceChange {
  return async (content, keywords) => persistResourceOperation(workspaceRoot, content, keywords)
}

export async function createResourceFolder(
  payload: z.input<typeof createPayloadSchema>,
  workspaceRoot = resolveWorkspaceRoot(),
  persistChange: PersistResourceChange = defaultPersistor(workspaceRoot),
) {
  const input = createPayloadSchema.parse(payload)
  const parent = resolveResourcePath(workspaceRoot, input.parentPath)

  if (!existsSync(parent.absolutePath)) {
    throw new ResourceOperationError('The selected parent path does not exist.', 404)
  }

  const target = resolveResourcePath(workspaceRoot, `${parent.relativePath}/${input.folderName}`)

  if (existsSync(target.absolutePath)) {
    throw new ResourceOperationError('A folder already exists at the target path.', 409)
  }

  await mkdir(target.absolutePath, { recursive: false })
  await updateResourcesConstitution(workspaceRoot, (entries) => {
    entries.set(target.relativePath, `Purpose: ${input.purpose}`)
  })

  await persistChange(
    `## Resources Structure Update\n**Operation**: create\n**Path**: ${target.relativePath}\n**Purpose**: ${input.purpose}`,
    ['resources', 'dashboard', 'create'],
  )

  return {
    ok: true,
    path: target.relativePath,
  }
}

export async function moveResourceFolder(
  payload: z.input<typeof movePayloadSchema>,
  workspaceRoot = resolveWorkspaceRoot(),
  persistChange: PersistResourceChange = defaultPersistor(workspaceRoot),
) {
  const input = movePayloadSchema.parse(payload)
  const source = resolveResourcePath(workspaceRoot, input.sourcePath)
  const destination = resolveResourcePath(workspaceRoot, input.destinationPath)

  assertFolderMutationAllowed(source.relativePath)
  assertFolderMutationAllowed(destination.relativePath)

  if (!existsSync(source.absolutePath)) {
    throw new ResourceOperationError('The source folder does not exist.', 404)
  }

  if (existsSync(destination.absolutePath)) {
    throw new ResourceOperationError('The destination path already exists.', 409)
  }

  if (!existsSync(dirname(destination.absolutePath))) {
    throw new ResourceOperationError('The destination parent path does not exist.', 404)
  }

  await rename(source.absolutePath, destination.absolutePath)
  await updateResourcesConstitution(workspaceRoot, (entries) => {
    const previousDescription = entries.get(source.relativePath) ?? `Reason: ${input.reason}`
    entries.delete(source.relativePath)
    entries.set(destination.relativePath, previousDescription)
  })

  await persistChange(
    `## Resources Structure Update\n**Operation**: move\n**From**: ${source.relativePath}\n**To**: ${destination.relativePath}\n**Reason**: ${input.reason}`,
    ['resources', 'dashboard', 'move'],
  )

  return {
    ok: true,
    from: source.relativePath,
    to: destination.relativePath,
  }
}

export async function deleteResourceFolder(
  payload: z.input<typeof deletePayloadSchema>,
  workspaceRoot = resolveWorkspaceRoot(),
  persistChange: PersistResourceChange = defaultPersistor(workspaceRoot),
) {
  const input = deletePayloadSchema.parse(payload)
  const target = resolveResourcePath(workspaceRoot, input.targetPath)

  assertFolderMutationAllowed(target.relativePath)

  if (!existsSync(target.absolutePath)) {
    throw new ResourceOperationError('The target folder does not exist.', 404)
  }

  await rm(target.absolutePath, { recursive: true, force: false })
  await updateResourcesConstitution(workspaceRoot, (entries) => {
    entries.delete(target.relativePath)
  })

  await persistChange(
    `## Resources Structure Update\n**Operation**: delete\n**Path**: ${target.relativePath}\n**Reason**: ${input.reason}`,
    ['resources', 'dashboard', 'delete'],
  )

  return {
    ok: true,
    path: target.relativePath,
  }
}