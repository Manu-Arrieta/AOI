/**
 * scripts/facts-consistency-guard.mjs
 *
 * Confronts the workspace's ICM `stack.*` facts with the tree they describe.
 *
 * WHY THIS EXISTS. An installed workspace carried, for months,
 * `stack.frameworks = Nuxt 4.4.6, Vue 3.5.34, @nuxt/ui 4.9.0, Tailwind 4.3,
 * Vitest 4.1.7` and `stack.packageManager = pnpm@11.3.0 (workspaces: aoi_apps/*)`
 * over a tree of 606 plain `.mjs` files with no dependencies at all. Nothing was
 * hallucinated: an earlier installer copied AOI's own `pnpm-workspace.yaml` into
 * the installation, `/init` followed `aoi_apps/*` into the dashboard's
 * `package.json`, and recorded exactly what it found.
 *
 * The installer bug was fixed and the file no longer ships. The facts it
 * produced stayed. That is the whole point of this guard: FIXING THE EMITTER
 * DOES NOT RETRACT WHAT IT ALREADY EMITTED. ICM keeps one database for every
 * project on the machine, outside any repository, so no reinstall, no
 * `aoi:sync-rules` and no git operation can reach a fact. Nothing in the doctor
 * looked at facts at all, which is why this survived unseen — while `icm
 * wake-up` served it to every session as settled, O(1), unverified truth.
 *
 * WHY A WARNING AND NEVER A FAILURE. The evidence here is weaker than the
 * parity gate's: a fact may legitimately describe something this tree cannot
 * show — a planned stack, a service in another repository, a language with no
 * manifest to read. Blocking the doctor on an inference would be the same
 * mistake as the installer that overwrote the Owner's `pnpm-workspace.yaml`. The
 * guard reports what it cannot corroborate and names the command that fixes it.
 *
 * Deterministic, zero inference tokens.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { resolveWorkspaceName } from './memoir-naming-guard.mjs'

const execFileAsync = promisify(execFile)

/** The facts worth confronting: the ones that name things a tree can confirm. */
export const AUDITED_FACT_KEYS = ['stack.frameworks', 'stack.packageManager']

/**
 * Claim token → the dependency name that would prove it.
 *
 * Deliberately small. A token is listed only when its absence from every
 * manifest is real evidence, never merely suggestive: these are packages that
 * cannot be used without being declared. Anything not listed is not judged, so
 * a fact naming Django or a Go module is left alone rather than guessed at.
 */
export const VERIFIABLE_PACKAGES = {
  nuxt: 'nuxt',
  vue: 'vue',
  react: 'react',
  next: 'next',
  svelte: 'svelte',
  angular: '@angular/core',
  express: 'express',
  vitest: 'vitest',
  jest: 'jest',
  tailwind: 'tailwindcss',
}

/** Directories never worth walking for a manifest. */
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'scaffold', 'dist', 'build', '.nuxt', '.output'])

/** How deep a `package.json` may hide and still count as this project's. */
export const MANIFEST_SCAN_DEPTH = 4

/**
 * A directory path named inside a fact value.
 *
 * The lookbehind carries the whole subtlety. `@` keeps a scoped package from
 * being read as a folder — without it `@nuxt/ui` was reported as a missing
 * `nuxt/ui/`, and noise is how a warning-only guard gets ignored. `/` keeps a
 * URL's own segments out, so `https://example.com/foo` contributes nothing.
 */
export const PATH_CLAIM = /(?<![@/A-Za-z0-9_.-])[A-Za-z0-9_.-]+\/[A-Za-z0-9_*.-]*/g

/**
 * `icm facts get` prints the value on the first line and its provenance on the
 * second. Only the first line is the fact.
 *
 * @param {unknown} stdout
 * @returns {string}
 */
export function parseFactValue(stdout) {
  return String(stdout ?? '').split('\n')[0].trim()
}

/**
 * Every dependency name declared by every `package.json` in the tree.
 *
 * @param {string} repoRoot
 * @returns {{ dependencies: Set<string>, manifestCount: number }}
 */
export function collectDeclaredDependencies(repoRoot, depth = MANIFEST_SCAN_DEPTH) {
  const dependencies = new Set()
  let manifestCount = 0

  const readManifest = (file) => {
    manifestCount += 1
    try {
      const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
        for (const name of Object.keys(manifest?.[field] ?? {})) dependencies.add(name)
      }
    } catch {
      // A malformed manifest is not this guard's problem to report.
    }
  }

  const walk = (dir, remaining) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isFile() && entry.name === 'package.json') readManifest(full)
      else if (entry.isDirectory() && remaining > 0 && isWalkable(entry.name)) walk(full, remaining - 1)
    }
  }

  walk(repoRoot, depth)
  return { dependencies, manifestCount }
}

/** A directory worth descending into while looking for manifests. */
function isWalkable(name) {
  return !SKIPPED_DIRS.has(name) && !name.startsWith('.')
}

/**
 * The verifiable package tokens a fact value names.
 *
 * @param {string} value
 * @returns {Array<{ token: string, dependency: string }>}
 */
export function extractPackageClaims(value) {
  const text = String(value ?? '').toLowerCase()
  return Object.entries(VERIFIABLE_PACKAGES)
    .filter(([token]) => new RegExp(`(^|[^a-z0-9@/-])${token}([^a-z0-9-]|$)`).test(text))
    .map(([token, dependency]) => ({ token, dependency }))
}

/**
 * The directory paths a fact value names, glob suffix stripped.
 *
 * This is what caught `workspaces: aoi_apps/*` over a tree with no `aoi_apps/`.
 *
 * The lookbehind is what keeps a scoped package from being read as a directory:
 * without it `@nuxt/ui` was reported as a missing `nuxt/ui/` folder, which is
 * noise — and noise is how a warning-only guard gets ignored.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function extractPathClaims(value) {
  const matches = String(value ?? '').match(PATH_CLAIM) ?? []
  return [...new Set(matches.map((m) => m.replace(/\/[*/]*$/, '')))].filter((m) => m !== '')
}

/**
 * Claims in one fact that the tree does not corroborate.
 *
 * @param {string} key
 * @param {string} value
 * @param {{ dependencies: Set<string>, manifestCount: number }} evidence
 * @param {string} repoRoot
 * @returns {string[]}
 */
export function unsupportedClaims(key, value, evidence, repoRoot) {
  const found = []

  // With no manifest anywhere there is no evidence base, so a package claim is
  // unjudgeable rather than false — the guard stays quiet instead of guessing.
  if (evidence.manifestCount > 0) {
    for (const { token, dependency } of extractPackageClaims(value)) {
      if (!evidence.dependencies.has(dependency)) {
        found.push(`${key} nombra "${token}" pero ningún package.json declara "${dependency}"`)
      }
    }
  }

  for (const claim of extractPathClaims(value)) {
    if (!fs.existsSync(path.join(repoRoot, claim))) {
      found.push(`${key} nombra la ruta "${claim}/" que no existe en el árbol`)
    }
  }

  return found
}

/** `icm facts get` exits 1 for an absent key, which is normal, not an error. */
function isFactMissing(error) {
  return /no active fact/i.test(`${error?.stdout ?? ''}${error?.stderr ?? ''}${error?.message ?? ''}`)
}

/**
 * Reads the workspace's audited facts and reports the claims the tree refutes.
 *
 * @param {string} repoRoot
 * @param {Function} [execFn]
 * @returns {Promise<{ status: string, details: string, workspace?: string, findings?: string[] }>}
 */
export async function checkFactsConsistency(repoRoot, execFn = execFileAsync) {
  const workspace = await resolveWorkspaceName(repoRoot, execFn)
  const evidence = collectDeclaredDependencies(repoRoot)
  const findings = []
  let read = 0

  for (const key of AUDITED_FACT_KEYS) {
    let value
    try {
      const { stdout } = await execFn('icm', ['facts', 'get', workspace, key])
      value = parseFactValue(stdout)
    } catch (error) {
      if (isFactMissing(error)) continue
      return {
        status: 'WARNING',
        workspace,
        details: `no se pudieron leer los facts de ${workspace}: ${String(error?.message ?? error).split('\n')[0]}`,
      }
    }
    if (!value) continue
    read += 1
    findings.push(...unsupportedClaims(key, value, evidence, repoRoot))
  }

  if (read === 0) {
    return {
      status: 'PASSED',
      workspace,
      findings: [],
      details: `${workspace} no tiene facts stack.* registrados todavía — corré /init para sembrarlos`,
    }
  }

  if (findings.length > 0) {
    return {
      status: 'WARNING',
      workspace,
      findings,
      details: `${findings.length} afirmación(es) de facts que el árbol no respalda: ${findings.join(' · ')} — corregí con \`icm facts set "${workspace}" "<key>" "<valor real>"\` (la historia se conserva)`,
    }
  }

  return {
    status: 'PASSED',
    workspace,
    findings: [],
    details: `${read} fact(s) stack.* coherentes con el árbol`,
  }
}
