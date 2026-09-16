#!/usr/bin/env node
/**
 * scripts/aoi-doctor.mjs
 *
 * AOI Workspace 360° Health Diagnostic Guard.
 *
 * This file owns ONE decision: turning the six checks into the single word
 * the Owner reads. The checks themselves live in `doctor-checks.mjs` —
 * separating them was what made it obvious that the verdict, not the checks,
 * was the part nothing tested.
 *
 * Deterministic, 0 inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateScaffoldParity } from './scaffold/validate-scaffold-parity.mjs'
import { checkMemoirNaming } from './memoir-naming-guard.mjs'
import {
  checkArchifySkill,
  checkBinaries,
  checkIcmHealth,
  checkMemoryGovernance,
  checkMultiHarnessRules,
  checkResourcesStructure,
  checkTaskRegistry,
  MANDATORY_BINARIES,
  RECOMMENDED_BINARIES,
} from './doctor-checks.mjs'

// Re-exported so callers that imported them from here keep working, and so
// the doctor's public surface stays one import for a consumer.
export {
  checkBinaries,
  checkIcmHealth,
  checkMemoirNaming,
  checkMemoryGovernance,
  checkMultiHarnessRules,
  checkResourcesStructure,
  checkTaskRegistry,
  MANDATORY_BINARIES,
  RECOMMENDED_BINARIES,
}

/**
 * El símbolo con el que el doctor reporta cada veredicto.
 *
 * Es una función, y exportada, porque vivía como dos `if` dentro del bloque de
 * impresión —el que corre sólo cuando este archivo es el programa principal—,
 * donde no se puede fijar con entradas. Por eso esas dos ramas sobrevivían a la
 * mutación mientras el resto del archivo estaba cubierto: el mapeo era
 * inalcanzable para cualquier test. Acá es una tabla que se puede afirmar.
 *
 * @param {string} status
 * @returns {string}
 */
export function statusSymbol(status) {
  if (status === 'WARNING') return '⚠️ '
  if (status === 'FAILED') return '❌'
  return '✅'
}

export async function runAoiDoctor(options = {}) {
  const repoRoot = options.repoRoot || process.cwd()
  // Passed through as-is: each check declares its own `execFileAsync`
  // default, so repeating it here was a second copy of the same decision —
  // and after the split it was a copy of something this file no longer
  // imports. The dashboard's route test caught it; the doctor's own tests
  // did not, because every one of them supplies an execFn.
  const execFn = options.execFn

  const binaryChecks = await checkBinaries(undefined, execFn)
  const icmCheck = await checkIcmHealth(execFn)
  // No es un binario de PATH: se chequea aparte, por la ruta del renderizador.
  const archifyCheck = checkArchifySkill()
  const registryCheck = checkTaskRegistry(repoRoot)
  const governanceCheck = checkMemoryGovernance(repoRoot)
  const resourcesCheck = checkResourcesStructure(repoRoot)
  const harnessCheck = checkMultiHarnessRules(repoRoot)
  // Lee la base compartida de ICM, así que necesita el mismo `execFn` que se
  // inyecta en los tests — sin él la compuerta quedaría fuera de todo test y
  // volvería a hablarle a la base real durante la suite.
  const memoirNamingCheck = await checkMemoirNaming(repoRoot, execFn)

  let parityCheck
  try {
    const parity = validateScaffoldParity(repoRoot)
    parityCheck = {
      status: parity.valid ? 'PASSED' : 'FAILED',
      details: parity.valid
        ? `${parity.checkedFilesCount} governed files verified byte-for-byte`
        : `${parity.errors.length} parity mismatch(es)`,
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
    {
      category: 'Memory Engine',
      name: 'ICM Doctor & DB Integrity',
      status: icmCheck.status,
      details: icmCheck.details,
      mandatory: true,
    },
    {
      category: 'Tooling',
      name: 'Archify Skill (Phase -2 diagram gate)',
      status: archifyCheck.status,
      details: archifyCheck.details,
      // Opcional, como Headroom: es una skill de terceros que se baja de
      // upstream, así que su ausencia degrada una compuerta opcional en vez de
      // romper el sistema. Marcarlo obligatorio hacía que el doctor fallara por
      // no tener una herramienta que el setup ya no exige.
      mandatory: false,
    },
    {
      category: 'SDD Lifecycle',
      name: 'Task Registry (.tasks/registry.md)',
      status: registryCheck.status,
      details: registryCheck.details,
      mandatory: true,
    },
    {
      category: 'Governance',
      name: 'Memory Versioning (active.json)',
      status: governanceCheck.status,
      details: governanceCheck.details,
      mandatory: true,
    },
    {
      category: 'Governance',
      name: 'Memoir Concept Naming',
      status: memoirNamingCheck.status,
      details: memoirNamingCheck.details,
      // Nunca obligatorio, y el guard tampoco devuelve FAILED. Los workspaces
      // anteriores al fix arrastran conceptos en kebab que puso AOI mismo, así
      // que bloquear por ellos sería repetir el error del instalador que
      // reemplazaba el `pnpm-workspace.yaml` del Owner. Reporta; no tranca.
      mandatory: false,
    },
    {
      category: 'Multi-Harness',
      name: 'AI Assistant Rules & Adapters',
      status: harnessCheck.status,
      details: harnessCheck.details,
      mandatory: false,
    },
    {
      category: 'Scaffold Mirror',
      name: 'Root <-> Scaffold Parity',
      status: parityCheck.status,
      details: parityCheck.details,
      mandatory: true,
    },
    {
      category: 'Resources',
      name: '.resources/ Subtree',
      status: resourcesCheck.status,
      details: resourcesCheck.details,
      mandatory: false,
    },
  ]

  const hasMandatoryFailure = allChecks.some(
    (c) => c.mandatory && c.status === 'FAILED'
  )
  const totalPassed = allChecks.filter((c) => c.status === 'PASSED').length
  const totalWarnings = allChecks.filter((c) => c.status === 'WARNING').length
  const totalFailed = allChecks.filter((c) => c.status === 'FAILED').length

  return {
    ok: !hasMandatoryFailure,
    timestamp: new Date().toISOString(),
    repoRoot,
    summary: {
      total: allChecks.length,
      passed: totalPassed,
      warnings: totalWarnings,
      failed: totalFailed,
    },
    checks: allChecks,
  }
}

// Direct CLI Execution
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  ;(async () => {
    console.log('\n🩺 Running AOI 360° Workspace Health Diagnostic...\n')
    const report = await runAoiDoctor()

    for (const check of report.checks) {
        const symbol = statusSymbol(check.status)
      console.log(
        `  ${symbol} [${check.category}] ${check.name}: ${check.details}`
      )
    }

    console.log(
      `\nDiagnostic Summary: ${report.summary.passed} Passed, ${report.summary.warnings} Warnings, ${report.summary.failed} Failed\n`
    )

    if (!report.ok) {
      console.error('❌ AOI Doctor detected mandatory integrity failures.\n')
      process.exit(1)
    } else {
      console.log('✨ AOI Workspace is fully operational and healthy.\n')
      process.exit(0)
    }
  })()
}
