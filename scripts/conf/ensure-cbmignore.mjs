#!/usr/bin/env node
/**
 * Appends AOI's owned Codebase Memory boundary without replacing an Owner's
 * existing ignore policy. A later gitignore rule wins, so the managed block
 * deliberately stays last and makes the graph topology true even when an
 * older workspace already had a .cbmignore.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const CBM_BOUNDARIES = Object.freeze({
  'control-plane': Object.freeze({
    marker: '# AOI managed Codebase Memory boundary: control-plane',
    patterns: Object.freeze(['scaffold/', 'aoi_apps/']),
  }),
  dashboard: Object.freeze({
    marker: '# AOI managed Codebase Memory boundary: dashboard',
    patterns: Object.freeze(['.output/']),
  }),
})

export function cbmBoundary(name) {
  const boundary = CBM_BOUNDARIES[name]
  if (!boundary) throw new Error(`Unknown Codebase Memory boundary: ${name}`)
  return boundary
}

export function renderedBoundary(name, eol = '\n') {
  const { marker, patterns } = cbmBoundary(name)
  return [marker, ...patterns, ''].join(eol)
}

/**
 * Returns an idempotent source string. Existing owner rules are preserved
 * byte-for-byte; only a missing or superseded AOI suffix is appended.
 */
export function withManagedCbmBoundary(source, name) {
  const current = String(source ?? '')
  const normalized = current.replaceAll('\r\n', '\n').trimEnd()
  const canonical = renderedBoundary(name).trimEnd()
  if (normalized.endsWith(canonical)) return { text: current, changed: false }

  const eol = current.includes('\r\n') ? '\r\n' : '\n'
  const separator = current.length === 0 ? '' : current.endsWith('\n') ? eol : `${eol}${eol}`
  return { text: `${current}${separator}${renderedBoundary(name, eol)}`, changed: true }
}

export function ensureCbmIgnoreBoundary(file, name) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const result = withManagedCbmBoundary(current, name)
  if (result.changed) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, result.text, 'utf8')
  }
  return { file, ...result }
}

function option(name) {
  const index = process.argv.indexOf(name)
  return index === -1 ? '' : process.argv[index + 1] ?? ''
}

function main() {
  const file = option('--file')
  const boundary = option('--boundary')
  if (!file || !boundary) {
    throw new Error('Usage: ensure-cbmignore.mjs --file <path> --boundary <control-plane|dashboard>')
  }
  const result = ensureCbmIgnoreBoundary(file, boundary)
  process.stdout.write(`${result.changed ? 'updated' : 'already-current'} ${result.file}\n`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
