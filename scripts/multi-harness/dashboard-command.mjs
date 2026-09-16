#!/usr/bin/env node
/** Execute a dashboard lifecycle command only when its selected profile owns it. */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { profileIncludesDashboard, readInstalledProfile } from '../installation-profiles.mjs'

export const DASHBOARD_COMMANDS = new Set(['dev', 'build', 'preview', 'prepare', 'test'])
export const DASHBOARD_DIRECTORY = path.join('aoi_apps', 'agentic-ops-dashboard')

export function resolveDashboardCommand(root, command) {
  if (!DASHBOARD_COMMANDS.has(command)) throw new Error(`Unknown dashboard command: ${command}`)

  const profile = readInstalledProfile(root)
  const packagePath = path.join(root, DASHBOARD_DIRECTORY, 'package.json')
  if (!fs.existsSync(packagePath)) {
    if (profileIncludesDashboard(profile)) {
      return { mode: 'error', profile, reason: 'el perfil Dashboard declara la aplicación pero falta su package.json' }
    }
    return { mode: 'skip', profile, reason: `el perfil ${profile} no instala el dashboard auxiliar` }
  }
  return { mode: 'run', profile, directory: path.dirname(packagePath) }
}

export function runDashboardCommand(root, command, run = spawnSync) {
  const decision = resolveDashboardCommand(root, command)
  if (decision.mode === 'skip') {
    process.stdout.write(`Dashboard ${command} omitido: ${decision.reason}.\n`)
    return 0
  }
  if (decision.mode === 'error') {
    process.stderr.write(`Dashboard ${command} no se puede ejecutar: ${decision.reason}. Reinstala con --profile dashboard.\n`)
    return 1
  }

  const commands = command === 'test' ? ['prepare', 'test'] : [command]
  for (const current of commands) {
    const result = run('pnpm', ['--dir', decision.directory, 'run', current], { stdio: 'inherit' })
    if (result.error || result.status !== 0) return result.status ?? 1
  }
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runDashboardCommand(process.cwd(), process.argv[2] ?? '')
  process.exitCode = exitCode
}
