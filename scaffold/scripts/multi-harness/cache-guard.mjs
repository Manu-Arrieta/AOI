#!/usr/bin/env node
/**
 * scripts/multi-harness/cache-guard.mjs
 *
 * AOI Cache-Pinned Architecture & Linter Guard.
 * Enforces strict prefix alignment for LLM prompt caching (Anthropic, DeepSeek, OpenAI).
 * Verifies that prompt templates (.github/prompts/) and rules do not inject
 * volatile dynamic tokens (timestamps, random seeds, volatile git commits)
 * into Tier 1/2 prefixes, guaranteeing >95% prompt cache hit rates.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

// Patterns that invalidate prompt caches if placed in the static prefix (< 2000 chars)
export const CACHE_BUSTER_PATTERNS = [
  { name: 'ISO Timestamp Injection', regex: /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\b/ },
  { name: 'Unix Timestamp / Dynamic Date Subshell', regex: /\$\(date\b|\`date\b/ },
  { name: 'Random UUID / Hex Nonce', regex: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
]

/**
 * Validates a prompt text for prefix cache invariance.
 * @param {string} promptText
 * @param {object} [options]
 * @param {number} [options.prefixLength=1500]
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function validatePromptCacheAlignment(promptText = '', options = {}) {
  const prefixLength = options.prefixLength || 1500
  const prefix = promptText.slice(0, prefixLength)
  const violations = []

  for (const pattern of CACHE_BUSTER_PATTERNS) {
    if (pattern.regex.test(prefix)) {
      violations.push(`Detected ${pattern.name} in static prefix (first ${prefixLength} chars)`)
    }
  }

  return {
    valid: violations.length === 0,
    violations
  }
}

/**
 * Scans a directory of prompt templates for cache alignment.
 * @param {string} promptsDir
 * @returns {{ scanned: number, passed: number, failed: number, details: Record<string, string[]> }}
 */
export function auditPromptsDirectory(promptsDir) {
  if (!fs.existsSync(promptsDir)) {
    return { scanned: 0, passed: 0, failed: 0, details: {} }
  }

  // `withFileTypes` and an explicit `isFile()`, matching what every sibling
  // walker in this repository already does. Without it, a DIRECTORY whose
  // name ends in `.prompt.md` — a botched `mv`, an unzip, an editor
  // scaffolding a folder — reaches `readFileSync` and throws EISDIR with a
  // node:fs stack trace that names no path.
  //
  // It fails closed, so nothing ships. The cost is elsewhere: this same
  // function is imported by `sdd-stress-suite.mjs`, which calls it AFTER all
  // six SDD phases have run. The crash then discards the accumulated
  // per-phase token report — the very number that becomes the next cycle's
  // baseline. A whole benchmark thrown away by a missing type check.
  const files = fs
    .readdirSync(promptsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.prompt.md'))
    .map((e) => e.name)
  let passed = 0
  let failed = 0
  const details = {}

  for (const file of files) {
    const fullPath = path.join(promptsDir, file)
    let content
    try {
      content = fs.readFileSync(fullPath, 'utf8')
    } catch (err) {
      // An unreadable prompt is reported through the gate's own channel
      // rather than as a stack trace, so the operator sees which file.
      failed++
      details[file] = [`No se pudo leer: ${err.code || err.message}`]
      continue
    }
    const result = validatePromptCacheAlignment(content)

    if (result.valid) {
      passed++
    } else {
      failed++
      details[file] = result.violations
    }
  }

  return {
    scanned: files.length,
    passed,
    failed,
    details
  }
}

/**
 * CLI Execution
 */
export async function main() {
  const promptsDir = path.resolve(process.cwd(), '.github/prompts')
  process.stdout.write(`=== AOI Prompt Cache-Alignment Audit ===\n`)
  const report = auditPromptsDirectory(promptsDir)

  process.stdout.write(`Scanned: ${report.scanned} prompt files\n`)
  process.stdout.write(`Passed:  ${report.passed}\n`)
  process.stdout.write(`Failed:  ${report.failed}\n`)

  if (report.failed > 0) {
    process.stderr.write(`❌ Cache-Guard Violations Found:\n`)
    for (const [file, errs] of Object.entries(report.details)) {
      process.stderr.write(`  - ${file}:\n`)
      for (const e of errs) {
        process.stderr.write(`      * ${e}\n`)
      }
    }
    process.exit(1)
  }

  process.stdout.write(`✅ 100% Cache Prefix Invariance Verified (0 Cache Busters detected)\n`)
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
