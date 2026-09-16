/**
 * scripts/memoir-naming-guard.mjs
 *
 * Guards the naming convention of ICM memoir concepts.
 *
 * WHY THIS EXISTS. The convention is PascalCase — `SandboxCompartment`,
 * `IntegrationManifest`, `BaseProjectMap` — because a concept names an entity.
 * It eroded twice, from two directions that shared no code:
 *
 *   - `setup.sh` bootstrapped the architecture graph with `sdd-lifecycle` and
 *     `hub-and-spoke`;
 *   - agents improvised over the `name: "<placeholder>"` their prompt leaves
 *     them, producing `base-project-map`, `harness-rule-derivation`,
 *     `scaffold-mirror-parity`.
 *
 * Measured across the 19 memoirs of the shared database: 155 Pascal concepts
 * against 110 kebab ones. Every artifact that fixes a name for real — both
 * installers, and `init.prompt.md`'s `BaseProjectMap` — writes Pascal, so the
 * kebab ones are all improvisation. `setup.sh` is fixed; this catches the rest.
 *
 * WHY A WARNING AND NEVER A FAILURE. Workspaces that predate the fix carry
 * kebab concepts AOI itself put there. Failing the doctor over data we created
 * is the same mistake as the installer that replaced a project's
 * `pnpm-workspace.yaml` — a tool that breaks the Owner's workspace on the way
 * in. The guard names what it found and how to fix it; it never blocks.
 *
 * Deterministic, zero inference tokens.
 */

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * The shape this guard treats as a violation: a name made only of lowercase
 * alphanumerics joined by `-`, `_` or a space.
 *
 * It is deliberately not "anything that is not PascalCase". That would flag
 * `.github/workflows/aoi-gate.yml` and `@nuxt/image`, which are real concept
 * names in existing memoirs and are not the erosion this exists to stop — a
 * path and a package name carry a `.`, `/` or `@`, so they fall out of this
 * character class and are left alone. `hub-and-spoke` and
 * `scaffold-mirror-parity` match and are caught.
 */
export const SEPARATED_LOWERCASE_NAME = /^[a-z0-9]+(?:[-_ ][a-z0-9]+)+$/

/**
 * The memoirs a workspace owns, by suffix.
 *
 * `icm memoir list` is not used to discover them: its only output is a text
 * table whose first column is the name, and names contain spaces
 * (`AOI TESTS v2.5.2-architecture`), so the columns cannot be split reliably.
 * There is no JSON format for it. `export` does have one, but needs the name
 * up front — hence a fixed candidate list, which also keeps the guard from
 * reading memoirs that belong to other workspaces in the shared database.
 */
export const WORKSPACE_MEMOIR_SUFFIXES = ['', '-architecture', '-domain-model']

/**
 * Classifies one concept name.
 *
 * @param {unknown} name
 * @returns {'violation'|'pascal'|'other'}
 */
export function classifyConceptName(name) {
  const value = String(name ?? '').trim()
  if (value === '') return 'other'
  if (SEPARATED_LOWERCASE_NAME.test(value)) return 'violation'
  if (/^[A-Z]/.test(value)) return 'pascal'
  return 'other'
}

/**
 * Every violating concept across the given memoirs, sorted for a stable
 * report — the doctor's output has to be diffable between two runs.
 *
 * @param {Array<{ name: string, concepts?: Array<{ name?: unknown }> }>} memoirs
 * @returns {Array<{ memoir: string, name: string }>}
 */
export function collectNamingViolations(memoirs) {
  const found = []
  for (const memoir of memoirs) {
    for (const concept of memoir?.concepts ?? []) {
      if (classifyConceptName(concept?.name) === 'violation') {
        found.push({ memoir: memoir.name, name: String(concept.name).trim() })
      }
    }
  }
  return found.sort((a, b) => a.memoir.localeCompare(b.memoir) || a.name.localeCompare(b.name))
}

/**
 * Parses `icm memoir export -f json`, returning null for anything unusable
 * rather than throwing: the guard's job is to report on memoirs, not to
 * become a second failure mode when one of them is malformed.
 *
 * @param {unknown} stdout
 * @returns {{ name: string, concepts: Array<{ name?: unknown }> } | null}
 */
export function parseMemoirExport(stdout) {
  try {
    const data = JSON.parse(String(stdout ?? ''))
    if (!data || !Array.isArray(data.concepts)) return null
    return { name: data.memoir?.name ?? '', concepts: data.concepts }
  } catch {
    return null
  }
}

/**
 * The workspace name, derived exactly as every prompt derives it: the git
 * remote's basename, minus `.git`, falling back to the directory name.
 *
 * A directory can be renamed; the remote usually cannot. Deriving from the
 * directory alone would silently point the guard at a memoir that does not
 * exist and report a clean bill of health for a workspace it never read.
 *
 * @param {string} repoRoot
 * @param {Function} [execFn]
 * @returns {Promise<string>}
 */
export async function resolveWorkspaceName(repoRoot, execFn = execFileAsync) {
  try {
    const { stdout } = await execFn('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot })
    const fromRemote = path.basename(String(stdout).trim()).replace(/\.git$/, '')
    if (fromRemote) return fromRemote
  } catch {
    // No remote, no git, or a detached checkout — the directory name is the
    // documented fallback, not an error.
  }
  return path.basename(path.resolve(repoRoot))
}

/**
 * `icm memoir export` exits 1 for a memoir that does not exist, which is the
 * NORMAL case here: most workspaces never create a `-domain-model`. Treating
 * that as an error would make the guard warn on every clean workspace.
 */
function isMemoirMissing(error) {
  const text = `${error?.stdout ?? ''}${error?.stderr ?? ''}${error?.message ?? ''}`
  return /memoir not found/i.test(text)
}

function firstLine(error) {
  return String(error?.message ?? error).split('\n')[0]
}

/** Caps the names in the report so one legacy workspace cannot flood the doctor. */
const MAX_NAMES_IN_REPORT = 5

/**
 * Reads the workspace's memoirs and reports concepts whose names violate the
 * convention.
 *
 * @param {string} repoRoot
 * @param {Function} [execFn]
 * @returns {Promise<{ status: string, details: string, workspace?: string, checkedMemoires?: string[], violations?: Array<{memoir: string, name: string}> }>}
 */
export async function checkMemoirNaming(repoRoot, execFn = execFileAsync) {
  const workspace = await resolveWorkspaceName(repoRoot, execFn)
  const candidates = WORKSPACE_MEMOIR_SUFFIXES.map((suffix) => `${workspace}${suffix}`)

  const read = []
  const errors = []

  for (const memoir of candidates) {
    try {
      const { stdout } = await execFn('icm', ['memoir', 'export', '-m', memoir, '-f', 'json'])
      const parsed = parseMemoirExport(stdout)
      if (parsed) read.push({ name: parsed.name || memoir, concepts: parsed.concepts })
    } catch (error) {
      if (!isMemoirMissing(error)) errors.push(`${memoir}: ${firstLine(error)}`)
    }
  }

  // Distinguishing "could not read" from "nothing to read" is the whole point
  // of collecting errors instead of swallowing them: an ICM that is present
  // but unusable would otherwise report as a workspace with no memoirs, which
  // is a clean bill of health for a graph nobody managed to open.
  if (read.length === 0 && errors.length > 0) {
    return {
      status: 'WARNING',
      details: `could not read workspace memoirs (${errors[0]})`,
      workspace,
      checkedMemoires: [],
      violations: [],
    }
  }

  if (read.length === 0) {
    return {
      status: 'PASSED',
      details: `no workspace memoir yet (${candidates.length} candidate name(s) checked)`,
      workspace,
      checkedMemoires: [],
      violations: [],
    }
  }

  const violations = collectNamingViolations(read)
  const checkedMemoires = read.map((m) => m.name)
  const conceptCount = read.reduce((sum, m) => sum + m.concepts.length, 0)

  if (violations.length === 0) {
    return {
      status: 'PASSED',
      details: `${conceptCount} concept(s) in ${read.length} memoir(s) named PascalCase`,
      workspace,
      checkedMemoires,
      violations: [],
    }
  }

  const shown = violations.slice(0, MAX_NAMES_IN_REPORT).map((v) => v.name).join(', ')
  const rest = violations.length > MAX_NAMES_IN_REPORT ? ` (+${violations.length - MAX_NAMES_IN_REPORT} more)` : ''

  // The remedy is prevention, and saying otherwise would be a lie worth
  // checking twice: `refine` only rewrites a definition in place (the name is
  // its lookup key), `add-concept` rejects a duplicate name with a UNIQUE
  // constraint, and there is no `delete-concept` — only `memoir delete`, which
  // takes the whole graph. Verified against ICM 0.10.63. So an existing
  // violation cannot be renamed out of the way; the only correction is
  // rebuilding the memoir.
  return {
    status: 'WARNING',
    details:
      `${violations.length} concept(s) not in PascalCase: ${shown}${rest} — ` +
      'add new concepts under their PascalCase name (BaseProjectMap). ICM has no ' +
      'rename and no per-concept delete — `refine` only rewrites a definition in ' +
      'place and `add-concept` rejects a duplicate name — so an existing violation ' +
      'is corrected only by rebuilding its memoir',
    workspace,
    checkedMemoires,
    violations,
  }
}
