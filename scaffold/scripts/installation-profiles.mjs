#!/usr/bin/env node
/**
 * The installer has three deliberately small distributions.  Keeping this
 * policy as code lets the installers, the scaffold mirror and package commands
 * agree about what "Core" means instead of each inferring it from a directory
 * that happens to be present.
 */

import fs from 'node:fs'
import path from 'node:path'

export const INSTALLATION_PROFILES = Object.freeze({
  core: Object.freeze({ advanced: false, dashboard: false }),
  advanced: Object.freeze({ advanced: true, dashboard: false }),
  dashboard: Object.freeze({ advanced: true, dashboard: true }),
})

export const INSTALLATION_PROFILE_NAMES = Object.freeze(Object.keys(INSTALLATION_PROFILES))
export const DEFAULT_INSTALLATION_PROFILE = 'core'
export const LEGACY_INSTALLATION_PROFILE = 'dashboard'

/** Normalizes a caller-selected profile and rejects an ambiguous value. */
export function normalizeInstallationProfile(value, fallback = DEFAULT_INSTALLATION_PROFILE) {
  const selected = String(value ?? fallback).trim().toLowerCase() || fallback
  if (!(selected in INSTALLATION_PROFILES)) {
    throw new Error(`Unknown AOI installation profile: ${selected}. Expected one of: ${INSTALLATION_PROFILE_NAMES.join(', ')}`)
  }
  return selected
}

export function profileIncludesAdvanced(profile) {
  return INSTALLATION_PROFILES[normalizeInstallationProfile(profile)].advanced
}

export function profileIncludesDashboard(profile) {
  return INSTALLATION_PROFILES[normalizeInstallationProfile(profile)].dashboard
}

/**
 * Auxiliary applications are an installer concern, never an owner workspace.
 * The profile therefore excludes the complete aoi_apps tree, including its
 * private pnpm workspace declaration, rather than leaving a partial app behind.
 */
export function profileExcludesRelativePath(profile, relativePath) {
  if (profileIncludesDashboard(profile)) return false
  const normalized = String(relativePath).replaceAll('\\', '/').replace(/^\.\//, '')
  return normalized === 'aoi_apps' || normalized.startsWith('aoi_apps/')
}

export function syncPathsForProfile(paths, profile) {
  const selected = normalizeInstallationProfile(profile)
  return paths.filter((entry) => !profileExcludesRelativePath(selected, entry))
}

/**
 * Older workspaces predate profiles but did ship the dashboard package. That
 * concrete artifact is safer evidence than a missing manifest: Windows may be
 * installed without Git Bash, in which case snapshot-conf cannot write one.
 * If the app exists we preserve the legacy Dashboard contract; if it does not,
 * the safe default is Core rather than inventing a missing application.
 */
export function readInstalledProfile(repoRoot, fallback = DEFAULT_INSTALLATION_PROFILE) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, '.conf', 'manifest.json'), 'utf8'))
    return normalizeInstallationProfile(manifest.installation_profile, fallback)
  } catch {
    const legacyDashboard = path.join(repoRoot, 'aoi_apps', 'agentic-ops-dashboard', 'package.json')
    return fs.existsSync(legacyDashboard) ? LEGACY_INSTALLATION_PROFILE : normalizeInstallationProfile(fallback)
  }
}
