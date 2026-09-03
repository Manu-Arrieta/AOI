#!/usr/bin/env node
/**
 * scripts/aoi-doctor.mjs
 *
 * AOI Workspace 360° Health Diagnostic Guard.
 * Deterministically checks tool binaries, ICM memory health, SDD task registry,
 * memory versioning governance, scaffold parity, and resource subtrees in 0ms/0 tokens.
 */

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { validateScaffoldParity } from './scaffold/validate-scaffold-parity.mjs'

const execFileAsync = promisify(execFile)

export const MANDATORY_BINARIES = [
  { name: 'icm', description: 'Infinite Context Memory CLI' },
]

export const RECOMMENDED_BINARIES = [
  { name: 'rtk', description: 'Real-Time Token Compressor' },
  { name: 'headroom', description: 'CLI Context Compression Layer' },
  { name: 'codebase-memory-mcp', description: 'Structural Graph AST Intelligence' },
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
  
  // Extract strictly the Tasks section if present, or all lines
  let targetBlock = content
  const tasksSectionMatch = content.match(/## Tasks\s*\n([\s\S]*?)(?=\n## |\Z)/)
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
export async function runAoiDoctor(options = {}) {
  const repoRoot = options.repoRoot || process.cwd()
  const execFn = options.execFn || execFileAsync

  const binaryChecks = await checkBinaries(undefined, execFn)
  const icmCheck = await checkIcmHealth(execFn)
  const registryCheck = checkTaskRegistry(repoRoot)
  const governanceCheck = checkMemoryGovernance(repoRoot)
  const resourcesCheck = checkResourcesStructure(repoRoot)
  const harnessCheck = checkMultiHarnessRules(repoRoot)

  let parityCheck
  try {
    const parity = validateScaffoldParity(repoRoot)
    parityCheck = {
      status: parity.valid ? 'PASSED' : 'FAILED',
      details: parity.valid ? `${parity.checkedFilesCount} governed files verified byte-for-byte` : `${parity.errors.length} parity mismatch(es)`,
      errors: parity.errors,
    }
  } catch (err) {
    parityCheck = {
      status: 'FAILED',
      details: err.message,
    }
  }

  const allChecks = [
    ...binaryChecks.map((b) => ({
      category: 'Tooling',
      name: `Binary: ${b.name}`,
      status: b.status,
      details: b.details,
      mandatory: b.mandatory,
    })),
    { category: 'Memory Engine', name: 'ICM Doctor & DB Integrity', status: icmCheck.status, details: icmCheck.details, mandatory: true },
    { category: 'SDD Lifecycle', name: 'Task Registry (.tasks/registry.md)', status: registryCheck.status, details: registryCheck.details, mandatory: true },
    { category: 'Governance', name: 'Memory Versioning (active.json)', status: governanceCheck.status, details: governanceCheck.details, mandatory: true },
    { category: 'Multi-Harness', name: 'AI Assistant Rules & Adapters', status: harnessCheck.status, details: harnessCheck.details, mandatory: false },
    { category: 'Scaffold Mirror', name: 'Root <-> Scaffold Parity', status: parityCheck.status, details: parityCheck.details, mandatory: true },
    { category: 'Resources', name: '.resources/ Subtree', status: resourcesCheck.status, details: resourcesCheck.details, mandatory: false },
  ]

  const hasMandatoryFailure = allChecks.some((c) => c.mandatory && c.status === 'FAILED')
  const totalPassed = allChecks.filter((c) => c.status === 'PASSED').length
  const totalWarnings = allChecks.filter((c) => c.status === 'WARNING').length
  const totalFailed = allChecks.filter((c) => c.status === 'FAILED').length

  return {
    ok: !hasMandatoryFailure,
    timestamp: new Date().toISOString(),
    repoRoot,
    summary: { total: allChecks.length, passed: totalPassed, warnings: totalWarnings, failed: totalFailed },
    checks: allChecks,
  }
}

// Direct CLI Execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  ;(async () => {
    console.log('\n🩺 Running AOI 360° Workspace Health Diagnostic...\n')
    const report = await runAoiDoctor()

    for (const check of report.checks) {
      let symbol = '✅'
      if (check.status === 'WARNING') symbol = '⚠️ '
      if (check.status === 'FAILED') symbol = '❌'

      console.log(`  ${symbol} [${check.category}] ${check.name}: ${check.details}`)
    }

    console.log(`\nDiagnostic Summary: ${report.summary.passed} Passed, ${report.summary.warnings} Warnings, ${report.summary.failed} Failed\n`)

    if (!report.ok) {
      console.error('❌ AOI Doctor detected mandatory integrity failures.\n')
      process.exit(1)
    } else {
      console.log('✨ AOI Workspace is fully operational and healthy.\n')
      process.exit(0)
    }
  })()
}
