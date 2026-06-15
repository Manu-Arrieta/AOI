#!/usr/bin/env node
// CLI: validate a `.sandboxes/{name}/integration-manifest.json` file against the
// shared manifest schema. Exit 0 + OK summary on success; exit 1 + stderr on
// failure. Wired into `/sdd-verify` as a FAIL gate.

import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { validateManifest } from './manifest-schema.mjs'

async function main() {
  const filePath = process.argv[2]

  if (!filePath) {
    process.stderr.write('usage: node validate-manifest.mjs <path-to-integration-manifest.json>\n')
    process.exitCode = 1
    return
  }

  let raw
  try {
    raw = JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    process.stderr.write(`${filePath}: ${error.message}\n`)
    process.exitCode = 1
    return
  }

  try {
    const manifest = validateManifest(raw, { filePath })
    process.stdout.write(`OK ${filePath}: ${manifest.compartments.length} compartments, ${manifest.elements.length} elements\n`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

main()
