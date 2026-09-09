#!/usr/bin/env node
/**
 * scripts/multi-harness/token-tool-coverage.mjs
 *
 * Every token-saving tool is mandatory, and every mandatory tool must actually
 * be reached by the cycle. Headroom is the single declared exception.
 *
 * The audit of 2026-09-09 found the two failure modes this gate exists to make
 * impossible, and neither was visible to any suite:
 *
 *   - `mcp-compressor`, which Invariant 1 names as THE mechanism behind its
 *     savings, was not a dependency, was never installed by setup.sh and was
 *     registered in no MCP config. The product advertised a saving whose
 *     machinery did not exist.
 *   - `context-tombstone` worked, was tested, and the benchmark credited it
 *     1.085 tokens a cycle — but no prompt and no agent ever invoked it. The
 *     benchmark counted a saving the real cycle could not obtain.
 *
 * So "does the tool exist?" is the wrong question. This asks three:
 *
 *   1. MANDATORY — is it treated as required by the installer, or can a run
 *      quietly continue without it?
 *   2. WIRED — does something in the real cycle invoke it? A reference inside
 *      the benchmark does not count: the benchmark measures, it does not run
 *      the product.
 *   3. CHANNEL — tools that compress what travels BETWEEN components are
 *      checked against the surfaces that carry that traffic, not merely
 *      against a phase prompt. A saving that only applies inside one phase
 *      leaves every hand-off paying full price.
 *
 * Static reading of files on disk: 0 inference tokens.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Surfaces that constitute "the real cycle" — the benchmark is deliberately absent. */
const CYCLE_SURFACES = ['.github/prompts', '.github/agents', '.github/instructions', '.github/skills']

/**
 * The inventory. `mandatory` is the Owner's policy, not an inference:
 * everything that saves tokens is required except Headroom.
 *
 * `channel` says what the tool compresses. `process` shrinks work inside a
 * phase; `communication` shrinks what crosses between components — shell
 * output into context, orchestrator into subagent, session into session.
 */
export const TOKEN_TOOLS = [
  { id: 'rtk', mandatory: true, channel: 'communication', needle: /\brtk\b/, requiredBy: /require_rtk/ },
  { id: 'icm', mandatory: true, channel: 'communication', needle: /\bicm\b/, requiredBy: /require_icm/ },
  { id: 'codebase-memory-mcp', mandatory: true, channel: 'communication', needle: /codebase-memory/, requiredBy: /CBM_CHOICE="y"/ },
  { id: 'toon', mandatory: true, channel: 'communication', needle: /toon|sanitize-subagent-payload/i, requiredBy: null },
  { id: 'context-tombstone', mandatory: true, channel: 'communication', needle: /context-tombstone|shrinkTurns/, requiredBy: null },
  { id: 'ast-skeletonizer', mandatory: true, channel: 'process', needle: /ast-skeletonizer|ast-lens/i, requiredBy: null },
  { id: 'context-arranger', mandatory: true, channel: 'process', needle: /context-arranger/, requiredBy: null },
  { id: 'synthesize-stubs', mandatory: true, channel: 'process', needle: /synthesize-stubs/, requiredBy: null },
  { id: 'diagnostic-distiller', mandatory: true, channel: 'process', needle: /diagnostic-distiller|distillTestOutput/, requiredBy: null },
  { id: 'mechanical-verify-union', mandatory: true, channel: 'process', needle: /mechanical-verify-union/, requiredBy: null },
  // Invariant 1 names this as THE mechanism behind its savings. It is not a
  // dependency, setup.sh never installs it, no MCP config registers it — and
  // `npm view` returns 404 for both `@atlassian-labs/mcp-compressor` and
  // `mcp-compressor`, so it was never implementable as written. It stays in
  // the inventory, and stays failing, because the claim is still published:
  // hiding it here would reproduce exactly the silence that let it survive.
  { id: 'mcp-compressor', mandatory: true, channel: 'communication', needle: /mcp-compressor/, requiredBy: /mcp-compressor/ },
  // The one declared exception. Its absence must never block a run.
  { id: 'headroom', mandatory: false, channel: 'process', needle: /headroom/i, requiredBy: null },
]

/** Reads a file, returning '' when absent. */
function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

/** Every file under the cycle surfaces, flattened. */
function cycleFiles(root) {
  const out = []
  for (const dir of CYCLE_SURFACES) {
    const full = path.join(root, dir)
    if (!fs.existsSync(full)) continue
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.name.endsWith('.md')) out.push(p)
      }
    }
    walk(full)
  }
  return out
}

/**
 * Where each tool is invoked inside the real cycle.
 *
 * @returns {Map<string, string[]>} tool id -> repo-relative files naming it
 */
export function wiringMap(root, tools = TOKEN_TOOLS) {
  const files = cycleFiles(root)
  const map = new Map(tools.map((t) => [t.id, []]))
  for (const file of files) {
    const text = read(file)
    for (const tool of tools) {
      if (tool.needle.test(text)) map.get(tool.id).push(path.relative(root, file))
    }
  }
  return map
}

/**
 * Audits policy and wiring together.
 *
 * @returns {{ notMandatory: string[], notWired: string[], rows: object[] }}
 */
export function auditTokenTools(root, tools = TOKEN_TOOLS) {
  const setup = read(path.join(root, 'setup.sh'))
  const map = wiringMap(root, tools)
  const notMandatory = []
  const notWired = []
  const rows = []

  for (const tool of tools) {
    const where = map.get(tool.id) ?? []
    // A tool is enforced when the installer refuses to continue without it.
    // `requiredBy: null` means enforcement lives in the cycle rather than in
    // the installer, so wiring alone decides.
    const enforced = tool.requiredBy ? tool.requiredBy.test(setup) : where.length > 0

    if (tool.mandatory && !enforced) {
      notMandatory.push(`${tool.id}: el instalador permite continuar sin él`)
    }
    if (tool.mandatory && where.length === 0) {
      notWired.push(`${tool.id} (${tool.channel}): ningún prompt, agente, instruction o skill lo invoca`)
    }
    rows.push({ id: tool.id, mandatory: tool.mandatory, channel: tool.channel, enforced, sites: where.length })
  }

  return { notMandatory, notWired, rows }
}

/** Table for the benchmark and the CLI. */
export function formatToolTable(rows) {
  return rows
    .map((r) => {
      const pol = r.mandatory ? 'obligatoria' : 'opcional   '
      const mark = !r.mandatory ? '–' : r.sites > 0 && r.enforced ? '✅' : '❌'
      return `  ${mark} ${r.id.padEnd(24)} ${pol}  ${r.channel.padEnd(14)} invocada en ${r.sites} superficie(s)`
    })
    .join('\n')
}

function main() {
  const root = process.cwd()
  const r = auditTokenTools(root)

  console.log('=== AOI Token-Saving Tool Coverage ===\n')
  console.log(formatToolTable(r.rows))
  console.log('\nTodas obligatorias salvo Headroom. "Invocada" cuenta prompts, agentes,')
  console.log('instructions y skills — nunca el benchmark, que mide pero no ejecuta el producto.')

  const failures = [...r.notMandatory, ...r.notWired]
  if (failures.length > 0) {
    console.error('')
    for (const f of failures) console.error(`❌ ${f}`)
    console.error('\nUna herramienta que existe pero nadie invoca es un ahorro que el ciclo no consigue.')
    process.exit(1)
  }
  console.log('\n✅ Cada herramienta obligatoria está exigida por el instalador y se invoca en el ciclo.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
}
