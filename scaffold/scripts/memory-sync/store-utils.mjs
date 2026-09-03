import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

import { loadJsonFile, validateActiveVersionIndex, validateMemoryBundle, validateMemoryVersionManifest } from './schema.mjs'

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function defaultVersionsRoot(cwd = process.cwd()) {
  return resolve(cwd, '.specify', 'memory', 'versions')
}

export function getRepositoryRoot(versionsRoot) {
  return resolve(versionsRoot, '..', '..', '..')
}

export function defaultExportsRoot(cwd = process.cwd()) {
  return resolve(cwd, '.exportsmemories')
}

export function getExportsRoot(versionsRoot) {
  return resolve(getRepositoryRoot(versionsRoot), '.exportsmemories')
}

export function resolveVersionStorePath(versionsRoot, relativePath) {
  if (relativePath.startsWith('.specify/memory/versions/')) {
    return join(versionsRoot, relativePath.replace('.specify/memory/versions/', ''))
  }

  return resolve(getRepositoryRoot(versionsRoot), relativePath)
}

export function getActiveIndexPath(versionsRoot) {
  return join(versionsRoot, 'active.json')
}

export function getManifestPath(versionsRoot, workspace, versionId) {
  return join(versionsRoot, 'manifests', workspace, `${versionId}.json`)
}

export function getTemplatePath(versionsRoot, templateName) {
  return join(versionsRoot, 'templates', templateName)
}

export function resolveExportArtifactPath(exportsRoot, relativeArtifactPath) {
  assert(typeof relativeArtifactPath === 'string' && relativeArtifactPath.trim().length > 0, 'relativeArtifactPath is required.')

  const normalizedRoot = resolve(exportsRoot)
  const resolvedPath = resolve(normalizedRoot, relativeArtifactPath)
  const relativePath = relative(normalizedRoot, resolvedPath)

  assert(relativePath.length > 0, 'Export artifact path must point to a file inside the exports root.')
  assert(!relativePath.startsWith('..') && !isAbsolute(relativePath), 'Export artifact path must stay within the exports root.')

  return resolvedPath
}

export async function loadActiveIndex(versionsRoot) {
  const activeIndexPath = getActiveIndexPath(versionsRoot)
  return validateActiveVersionIndex(await loadJsonFile(activeIndexPath), { filePath: activeIndexPath })
}

export async function loadManifestAtPath(manifestPath) {
  return validateMemoryVersionManifest(await loadJsonFile(manifestPath), { filePath: manifestPath })
}

export async function writeJsonFile(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeTextFile(filePath, value) {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, value, 'utf8')
}

export function computeSha256Hex(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8')
  return createHash('sha256').update(buffer).digest('hex')
}

export async function writeGzipJsonFile(filePath, value) {
  const raw = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
  const compressed = gzipSync(raw)

  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, compressed)

  return compressed
}

export async function loadGzipJsonFile(filePath) {
  const compressed = await readFile(filePath)
  const raw = gunzipSync(compressed).toString('utf8')

  return JSON.parse(raw)
}

export async function loadMemoryBundleAtPath(filePath) {
  return validateMemoryBundle(await loadGzipJsonFile(filePath), { filePath })
}

export async function renderTemplate(templatePath, replacements) {
  let raw = await readFile(templatePath, 'utf8')

  for (const [token, value] of Object.entries(replacements)) {
    raw = raw.replaceAll(token, value)
  }

  return raw
}