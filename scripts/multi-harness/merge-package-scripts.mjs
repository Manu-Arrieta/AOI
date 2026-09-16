#!/usr/bin/env node
/**
 * scripts/multi-harness/merge-package-scripts.mjs
 *
 * Adds AOI's npm scripts to a package.json that already belongs to someone.
 *
 * Installing AOI into an existing project is its primary use case, and the
 * installer used to satisfy it by overwriting `package.json` outright — a
 * project's name, version, dependencies and scripts replaced by the
 * scaffold's. Protecting the file solved that and created the opposite
 * problem: AOI's gates are npm scripts, so without them the workspace has the
 * files and none of the commands.
 *
 * So the file is merged, not replaced, and the merge is deliberately timid:
 *
 *   - Only `scripts` is touched. Nothing else in the manifest is AOI's
 *     business, and a dependency the Owner pinned is theirs to pin.
 *   - A script the Owner already defines is NEVER overwritten. If they have
 *     their own `test`, AOI's lands as `aoi:test` beside it rather than
 *     taking the name — a `pnpm test` that stops running their suite is a
 *     worse failure than a missing gate.
 *   - Everything it did is reported, because a silent edit to a manifest is
 *     how trust in an installer dies.
 *
 * Zero inference tokens: JSON in, JSON out.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { normalizeInstallationProfile, profileIncludesDashboard } from '../installation-profiles.mjs'

/**
 * Scripts AOI needs; anything else in its manifest is not the Owner's concern.
 *
 * `*:dashboard` is in here as a family, not as five entries. The dashboard is
 * an auxiliary app the Owner may legitimately want to run, and its lifecycle
 * scripts all share that namespace. Before this, only `test:dashboard` matched
 * (through the `test` prefix) and so it was the ONLY one merged: a project that
 * already had a `package.json` got `pnpm test:dashboard` and nothing to build
 * or serve with.
 */
const WANTED = /^(test|aoi:|sync:|[a-z]+:dashboard$)/

/**
 * Merges the scaffold's AOI scripts into an existing manifest.
 *
 * @returns {{ manifest: object, added: string[], renamed: Array<[string,string]>, untouched: string[] }}
 */
export function mergeScripts(ownerManifest, scaffoldManifest, { profile = 'dashboard' } = {}) {
  const selectedProfile = normalizeInstallationProfile(profile)
  const manifest = { ...ownerManifest }
  const ownerScripts = { ...(ownerManifest.scripts ?? {}) }
  const incoming = scaffoldManifest.scripts ?? {}

  const added = []
  const renamed = []
  const untouched = []

  for (const [name, body] of Object.entries(incoming)) {
    if (!WANTED.test(name)) continue
    if (name.endsWith(':dashboard') && !profileIncludesDashboard(selectedProfile)) continue

    if (!(name in ownerScripts)) {
      ownerScripts[name] = body
      added.push(name)
      continue
    }

    if (ownerScripts[name] === body) {
      untouched.push(name)
      continue
    }

    // The Owner defines this name differently. Theirs wins; AOI's gets a
    // prefixed home so the capability still exists and can be wired by hand.
    const alias = name.startsWith('aoi:') ? `${name}-aoi` : `aoi:${name}`
    if (!(alias in ownerScripts)) {
      ownerScripts[alias] = body
      renamed.push([name, alias])
    } else {
      untouched.push(name)
    }
  }

  manifest.scripts = ownerScripts
  return { manifest, added, renamed, untouched }
}

function main() {
  const [ownerPath, scaffoldPath, ...options] = process.argv.slice(2)
  if (!ownerPath || !scaffoldPath) {
    process.stderr.write('uso: merge-package-scripts.mjs <package.json del proyecto> <package.json del scaffold> [--profile core|advanced|dashboard]\n')
    process.exit(2)
  }

  let profile = 'dashboard'
  if (options.length > 0) {
    if (options[0] !== '--profile' || !options[1] || options.length !== 2) {
      process.stderr.write('uso: --profile core|advanced|dashboard\n')
      process.exit(2)
    }
    try {
      profile = normalizeInstallationProfile(options[1])
    } catch (err) {
      process.stderr.write(`${err.message}\n`)
      process.exit(2)
    }
  }

  let owner
  let scaffold
  try {
    owner = JSON.parse(fs.readFileSync(ownerPath, 'utf8'))
    scaffold = JSON.parse(fs.readFileSync(scaffoldPath, 'utf8'))
  } catch (err) {
    // A manifest we cannot parse is one we must not rewrite.
    process.stderr.write(`No se pudo leer un package.json: ${err.message}\n`)
    process.exit(1)
  }

  const { manifest, added, renamed, untouched } = mergeScripts(owner, scaffold, { profile })

  if (added.length === 0 && renamed.length === 0) {
    console.log('package.json ya tenía todos los scripts de AOI — sin cambios.')
    return
  }

  fs.writeFileSync(ownerPath, `${JSON.stringify(manifest, null, 2)}\n`)

  if (added.length > 0) console.log(`  + agregados: ${added.join(', ')}`)
  for (const [name, alias] of renamed) {
    console.log(`  ~ ya tenías "${name}"; el de AOI quedó como "${alias}"`)
  }
  if (untouched.length > 0) console.log(`  = sin tocar: ${untouched.length} ya coincidían`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
