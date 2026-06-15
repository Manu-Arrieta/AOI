#!/usr/bin/env node
// Base-project map detector for `.specify/memory/base-project.json` (OQ-6).
//
// Two layers:
//   1. `classifyRoots({ cwd, pnpmWorkspace, packageJsons })` — PURE function that
//      classifies already-read workspace inputs into
//      `{ frontend[], backend[], sharedLibs[] }`. No filesystem access, so it is
//      trivially unit-testable with in-memory fixtures.
//   2. CLI — reads the real `pnpm-workspace.yaml` + each `package.json` from disk,
//      calls `classifyRoots`, and prints the PROPOSED `base-project.json` shape to
//      stdout. It NEVER writes the file; the confirmed write happens only in
//      `/init` after the Owner approves/corrects the proposal.
//
// Dependency-light (Node built-ins only), mirroring the `scripts/sandbox/`
// (`manifest-schema.mjs`) and `scripts/memory-sync/schema.mjs` precedents. No
// `yaml`/`glob` dependency — a small line parser handles the `packages:` list.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Dependency signatures that classify a package by its `package.json` deps.
export const frontendSignatures = new Set(['nuxt', 'vue', 'react', 'next', 'vite'])
export const backendSignatures = new Set(['nitro', 'express', 'fastify', 'h3', 'nest', 'koa', 'hapi'])

// AOI's own internal tooling roots. Packages under these directories are part of
// the AOI ecosystem itself (e.g. the agentic-ops dashboard) and MUST never be
// proposed as the downstream project's base-project roots.
export const aoiInternalTopDirs = new Set(['aoi_apps'])

function normalizeDir(dir) {
  return String(dir ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
}

function joinRelative(dir, child) {
  const base = normalizeDir(dir)
  return base ? `${base}/${child}` : child
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value)
  }
}

function collectDependencyNames(packageJson) {
  const names = new Set()
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const group = packageJson?.[field]
    if (group && typeof group === 'object') {
      for (const name of Object.keys(group)) {
        names.add(name)
      }
    }
  }
  return names
}

function matchesSignature(depNames, signatures) {
  for (const name of depNames) {
    if (signatures.has(name)) {
      return true
    }
    // Scoped backend frameworks, e.g. `@nestjs/core`, `@nestjs/common`.
    if (signatures.has('nest') && name.startsWith('@nestjs/')) {
      return true
    }
  }
  return false
}

function isUnderTopDir(dir, topDir) {
  const normalized = normalizeDir(dir)
  return normalized === topDir || normalized.startsWith(`${topDir}/`)
}

// True when `dir` belongs to one of AOI's own internal tooling roots.
function isAoiInternal(dir) {
  for (const topDir of aoiInternalTopDirs) {
    if (isUnderTopDir(dir, topDir)) {
      return true
    }
  }
  return false
}

/**
 * Classify workspace packages into base-project roots.
 *
 * @param {object} input
 * @param {string} [input.cwd] - Base root reference (informational; defaults to ".").
 * @param {string|null} [input.pnpmWorkspace] - Raw `pnpm-workspace.yaml` text (informational).
 * @param {Array<{ dir: string, packageJson?: object, json?: object, hasServerDir?: boolean }>} [input.packageJsons]
 * @returns {{ frontend: string[], backend: string[], sharedLibs: string[] }}
 */
export function classifyRoots({ cwd = '.', pnpmWorkspace = null, packageJsons = [] } = {}) {
  void cwd
  void pnpmWorkspace

  const frontend = []
  const backend = []
  const sharedLibs = []

  for (const entry of packageJsons ?? []) {
    const dir = normalizeDir(entry?.dir)
    if (!dir) {
      continue
    }

    // AOI's own apps (aoi_apps/*) are ecosystem tooling, never the downstream
    // project's base-project roots — skip them entirely.
    if (isAoiInternal(dir)) {
      continue
    }

    const packageJson = entry?.packageJson ?? entry?.json ?? {}
    const hasServerDir = Boolean(entry?.hasServerDir)
    const depNames = collectDependencyNames(packageJson)

    const isFrontend = matchesSignature(depNames, frontendSignatures)
    const isBackendByDeps = matchesSignature(depNames, backendSignatures)
    const isBackend = isBackendByDeps || hasServerDir

    let classified = false

    if (isFrontend) {
      pushUnique(frontend, dir)
      classified = true
    }

    if (isBackend) {
      // A frontend app that carries a `server/` directory contributes that nested
      // directory as the backend root; a standalone server package contributes
      // its own directory.
      const backendRoot = hasServerDir ? joinRelative(dir, 'server') : dir
      pushUnique(backend, backendRoot)
      classified = true
    }

    if (!classified) {
      // Ambiguous signatures → fall back to path heuristics (OQ-6 step 3):
      // `apps/*` ⇒ frontend, `packages/*` ⇒ sharedLibs, otherwise sharedLibs
      // (a package with no app entry / build server).
      if (isUnderTopDir(dir, 'apps')) {
        pushUnique(frontend, dir)
      } else {
        pushUnique(sharedLibs, dir)
      }
    }
  }

  frontend.sort()
  backend.sort()
  sharedLibs.sort()

  return { frontend, backend, sharedLibs }
}

/**
 * Parse the `packages:` list out of `pnpm-workspace.yaml` without a YAML
 * dependency. Returns workspace-relative glob strings, skipping `!`-exclusions.
 */
export function parsePnpmWorkspacePackages(yamlText) {
  if (typeof yamlText !== 'string' || yamlText.trim().length === 0) {
    return []
  }

  const packages = []
  let inPackages = false

  for (const rawLine of yamlText.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ')
    const trimmed = line.trim()

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    if (!inPackages) {
      if (/^packages\s*:/.test(trimmed)) {
        inPackages = true
      }
      continue
    }

    const listItem = line.match(/^\s*-\s*(.+?)\s*$/)
    if (listItem) {
      let value = listItem[1].trim().replace(/^['"]|['"]$/g, '')
      if (value && !value.startsWith('!')) {
        packages.push(value)
      }
      continue
    }

    // A new non-indented key ends the `packages:` block.
    if (/^\S/.test(line)) {
      inPackages = false
    }
  }

  return packages
}

function isDirectory(absPath) {
  try {
    return fs.statSync(absPath).isDirectory()
  } catch {
    return false
  }
}

/**
 * Expand a simple pnpm-workspace glob (e.g. `apps/*`, `packages/*`, exact paths)
 * against the filesystem into workspace-relative directory paths. `*` and `**`
 * match immediate child directories.
 */
export function expandWorkspaceGlob(glob, cwd) {
  const segments = normalizeDir(glob).split('/').filter(Boolean)
  let candidates = ['']

  for (const segment of segments) {
    const next = []
    for (const base of candidates) {
      const absBase = path.join(cwd, base)
      if (segment === '*' || segment === '**') {
        let entries = []
        try {
          entries = fs.readdirSync(absBase, { withFileTypes: true })
        } catch {
          entries = []
        }
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            next.push(base ? `${base}/${entry.name}` : entry.name)
          }
        }
      } else {
        const candidate = base ? `${base}/${segment}` : segment
        if (isDirectory(path.join(cwd, candidate))) {
          next.push(candidate)
        }
      }
    }
    candidates = next
  }

  return candidates
}

/**
 * Read the real workspace from disk and build the proposed `base-project.json`
 * object. Does NOT write any file.
 */
export function detectFromDisk(cwd = process.cwd()) {
  const workspacePath = path.join(cwd, 'pnpm-workspace.yaml')

  let pnpmWorkspace = null
  let globs = []
  if (fs.existsSync(workspacePath)) {
    pnpmWorkspace = fs.readFileSync(workspacePath, 'utf8')
    globs = parsePnpmWorkspacePackages(pnpmWorkspace)
  }

  if (globs.length === 0) {
    // OQ-6 step 3 fallback when no workspace manifest is present.
    globs = ['apps/*', 'packages/*']
  }

  const dirs = new Set()
  for (const glob of globs) {
    for (const dir of expandWorkspaceGlob(glob, cwd)) {
      dirs.add(dir)
    }
  }

  const packageJsons = []
  for (const dir of dirs) {
    const packageJsonPath = path.join(cwd, dir, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      continue
    }
    let packageJson
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    } catch {
      continue
    }
    packageJsons.push({
      dir,
      packageJson,
      hasServerDir: isDirectory(path.join(cwd, dir, 'server')),
    })
  }

  const roots = classifyRoots({ cwd: '.', pnpmWorkspace, packageJsons })

  return {
    $schemaVersion: 1,
    baseRoot: '.',
    detectedAt: new Date().toISOString(),
    // `confirmedBy` stays null in the proposal; `/init` sets it after the Owner
    // confirms/corrects the detection and writes the file.
    confirmedBy: null,
    workspaceManager: pnpmWorkspace ? 'pnpm' : 'unknown',
    roots,
  }
}

function main() {
  const cwd = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
  const proposal = detectFromDisk(cwd)
  process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`)
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main()
}
