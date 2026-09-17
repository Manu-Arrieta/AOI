/**
 * scripts/doctor-checks.mjs
 *
 * The individual health checks the diagnostic runs.
 *
 * Split out of `aoi-doctor.mjs` when that file sat at 317 LOC against the
 * 300 limit — and the split is the right shape anyway, not a way to satisfy
 * a number. Each function here answers ONE question about the workspace and
 * returns a status with its reason; `aoi-doctor.mjs` keeps the part that
 * turns those answers into one verdict for the Owner. Those are two different
 * jobs, and the mutation probe made the difference visible: the verdict was
 * the unconstrained half.
 *
 * Every check is deterministic and reads the filesystem or a binary's
 * version output. Zero inference tokens.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { checkArchifySkill, findArchifyRenderer } from './archify-checks.mjs'

// El split no cambia la superficie pública: se re-exporta lo que se movió, así
// que `archify-path.mjs`, `aoi-doctor.mjs` y `blueprint-gate.mjs` siguen
// importando de acá sin enterarse. Mismo precedente que `test-reachability.mjs`.
export { checkArchifySkill, findArchifyRenderer }

const execFileAsync = promisify(execFile)

// The Owner's policy on token-saving tooling has one shape and one exception:
// every saving tool is mandatory, and Headroom alone may be absent. This list
// used to hold `icm` by itself, with `rtk` and `codebase-memory-mcp` sitting in
// RECOMMENDED next to `headroom` — so the diagnostic told the operator that two
// mandatory tools were merely advisable, and put the single declared exception
// in the same basket as the obligations it exists to contrast with.
//
// The verdict reads `c.mandatory && c.status === 'FAILED'`, so this list is not
// documentation: it decides which absence can condemn a workspace. A saving
// tool listed as recommended cannot fail the doctor, which is the same as not
// being required at all.
export const MANDATORY_BINARIES = [
  { name: 'icm', description: 'Infinite Context Memory CLI' },
  { name: 'rtk', description: 'Real-Time Token Compressor' },
  { name: 'codebase-memory-mcp', description: 'Structural Graph AST Intelligence' },
]

// Headroom is the one declared exception. `specify` stays here because it is a
// spec-kit dependency rather than a token-saving tool, so the policy above does
// not reach it.
export const RECOMMENDED_BINARIES = [
  { name: 'headroom', description: 'CLI Context Compression Layer' },
  { name: 'specify', description: 'Spec-Driven Development CLI' },
]

/**
 * Checks presence and version of CLI binaries.
 */
export async function checkBinaries(binaries = [...MANDATORY_BINARIES, ...RECOMMENDED_BINARIES], execFn = execFileAsync) {
  const results = []
  const whichCmd = process.platform === 'win32' ? 'where' : 'which'

  for (const bin of binaries) {
    const isMandatory = MANDATORY_BINARIES.some((m) => m.name === bin.name)
    try {
      const { stdout } = await execFn(whichCmd, [bin.name])
      const binaryPath = stdout.trim().split(/\r?\n/)[0].trim()
      results.push({
        name: bin.name,
        description: bin.description,
        status: 'PASSED',
        mandatory: isMandatory,
        details: binaryPath,
      })
    } catch {
      results.push({
        name: bin.name,
        description: bin.description,
        status: isMandatory ? 'FAILED' : 'WARNING',
        mandatory: isMandatory,
        details: isMandatory ? 'Mandatory binary not found in PATH' : 'Optional/Recommended binary not found',
      })
    }
  }

  return results
}

/**
 * Checks ICM engine health via `icm doctor` and facts query.
 */
export async function checkIcmHealth(execFn = execFileAsync) {
  try {
    const { stdout } = await execFn('icm', ['doctor'])
    const isOk = (stdout.includes('healthy') || stdout.includes('Database integrity: ok')) && !stdout.includes('error') && !stdout.includes('corrupt')
    return {
      status: isOk ? 'PASSED' : 'WARNING',
      details: stdout.trim().split('\n').pop() || 'ICM doctor check complete',
      raw: stdout,
    }
  } catch (error) {
    return {
      status: 'FAILED',
      details: error.message || 'Failed to execute icm doctor',
    }
  }
}

/**
 * Validates coherence of `.tasks/registry.md` against physical task directories.
 */
export function checkTaskRegistry(repoRoot) {
  const registryPath = path.join(repoRoot, '.tasks', 'registry.md')
  if (!fs.existsSync(registryPath)) {
    return {
      status: 'FAILED',
      details: 'Missing .tasks/registry.md',
      taskCount: 0,
    }
  }

  const content = fs.readFileSync(registryPath, 'utf8')
  
  // Extract strictly the Tasks section if present, or all lines.
  //
  // The terminator used to be `\Z`, which is Perl and Python — JavaScript
  // has no such escape, so it matched a literal "Z". Whenever `## Tasks` was
  // the LAST section, which is the normal shape, nothing terminated the
  // group, the match failed, and the scan silently fell back to the whole
  // document: rows from every other section were counted as tasks and the
  // doctor then failed looking for folders that were never meant to exist.
  let targetBlock = content
  const tasksSectionMatch = content.match(/## Tasks\s*\n([\s\S]*?)(?=\n## |$)/)
  if (tasksSectionMatch) {
    targetBlock = tasksSectionMatch[1]
  }

  const rows = targetBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !line.includes('---'))

  const issues = []
  let taskCount = 0

  for (const row of rows) {
    const cols = row.split('|').map((c) => c.trim()).filter(Boolean)
    if (cols.length >= 2) {
      const taskId = cols[0]
      const feature = cols[1]

      // Only evaluate genuine task IDs (e.g. TASK-YYYY-NNN) and ignore header row
      if (taskId && feature && taskId.toUpperCase() !== 'TASK-ID' && /^TASK-\d{4}-\d+/i.test(taskId)) {
        taskCount++
        const taskDir = path.join(repoRoot, '.tasks', feature, taskId)
        if (!fs.existsSync(taskDir)) {
          issues.push(`Task ${taskId} (${feature}) registered but folder .tasks/${feature}/${taskId} does not exist`)
        }
      }
    }
  }

  return {
    status: issues.length === 0 ? 'PASSED' : 'FAILED',
    taskCount,
    issues,
    details: issues.length === 0 ? `${taskCount} task(s) verified in registry` : `${issues.length} registry inconsistencies`,
  }
}

/**
 * Validates memory governance versioning state.
 */
export function checkMemoryGovernance(repoRoot) {
  const activeJsonPath = path.join(repoRoot, '.specify', 'memory', 'versions', 'active.json')
  if (!fs.existsSync(activeJsonPath)) {
    return {
      status: 'FAILED',
      details: 'Missing .specify/memory/versions/active.json',
    }
  }

  try {
    const activeData = JSON.parse(fs.readFileSync(activeJsonPath, 'utf8'))
    const workspaceStates = activeData.workspaceStates || {}
    const workspaces = Object.keys(workspaceStates)

    const issues = []
    for (const ws of workspaces) {
      const state = workspaceStates[ws]
      if (state.activeVersionId) {
        const manifestPath = path.join(repoRoot, '.specify', 'memory', 'versions', 'manifests', ws, `${state.activeVersionId}.json`)
        if (!fs.existsSync(manifestPath)) {
          issues.push(`Active manifest for workspace "${ws}" (${state.activeVersionId}) missing on disk`)
        }
      }
    }

    return {
      status: issues.length === 0 ? 'PASSED' : 'FAILED',
      workspaces: workspaces.length,
      issues,
      details: issues.length === 0 ? `${workspaces.length} workspace state(s) consistent` : `${issues.length} governance manifest issue(s)`,
    }
  } catch (error) {
    return {
      status: 'FAILED',
      details: `Invalid active.json: ${error.message}`,
    }
  }
}

/**
 * Validates .resources/ governed subtree structure.
 */
export function checkResourcesStructure(repoRoot) {
  const resourcesDir = path.join(repoRoot, '.resources')
  if (!fs.existsSync(resourcesDir)) {
    return {
      status: 'WARNING',
      details: 'Optional .resources/ folder not initialized',
    }
  }

  const constitutionPath = path.join(resourcesDir, 'constitution.md')
  const hasConstitution = fs.existsSync(constitutionPath)
  const userstoriesDir = path.join(resourcesDir, 'userstories')
  const workflowsDir = path.join(resourcesDir, 'workflows')

  const issues = []
  if (!hasConstitution) issues.push('Missing .resources/constitution.md')
  if (!fs.existsSync(userstoriesDir)) issues.push('Missing .resources/userstories/ directory')
  if (!fs.existsSync(workflowsDir)) issues.push('Missing .resources/workflows/ directory')

  return {
    status: issues.length === 0 ? 'PASSED' : 'WARNING',
    details: issues.length === 0 ? '.resources/ subtree structure valid' : issues.join('; '),
  }
}

/**
 * Validates multi-harness rules presence.
 */
export function checkMultiHarnessRules(repoRoot) {
  const harnesses = [
    { name: 'Copilot', file: '.github/copilot-instructions.md' },
    { name: 'Claude', file: 'CLAUDE.md' },
    { name: 'Cursor', file: '.cursorrules' },
    { name: 'Antigravity', file: 'AGENTS.md' },
    { name: 'Cline', file: '.clinerules' },
  ]
  const present = harnesses.filter((h) => fs.existsSync(path.join(repoRoot, h.file)))
  if (present.length === 0) {
    return {
      status: 'WARNING',
      details: 'No multi-harness instruction adapters found. Run `pnpm aoi:sync-rules` to compile.',
    }
  }
  return {
    status: 'PASSED',
    details: `${present.length} harness adapter(s) active (${present.map((h) => h.name).join(', ')})`,
  }
}

/**
 * Runs full 360° diagnostic check.
 */
