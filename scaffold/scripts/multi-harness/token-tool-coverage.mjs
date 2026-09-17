#!/usr/bin/env node
/**
 * scripts/multi-harness/token-tool-coverage.mjs
 *
 * Core carries the deterministic token-saving substrate. Advanced and
 * Dashboard additionally require Codebase Memory; every tool declared by a
 * profile must actually be reached by the cycle. Headroom remains optional.
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
 * The inventory. `mandatory` is the Owner's policy, not an inference.
 *
 * There used to be a `profiles` field here, and `codebase-memory-mcp` carried
 * `['advanced','dashboard']`: an obligation narrowed to a distribution. Core is
 * the default AND the only profile reachable without a flag — neither installer
 * asks for one — so the narrowing made a mandatory tool optional for everyone
 * who installs the documented way, and this gate reported ✅ the whole time
 * because its own `requiredBy` embedded the Core bypass it should have refused.
 *
 * The Owner settled it on 2026-09-17: every saving tool is mandatory in every
 * profile, and Headroom is the single exception. The field is gone rather than
 * merely unused, because its existence is the move that has to be impossible.
 *
 * `channel` says what the tool compresses. `process` shrinks work inside a
 * phase; `communication` shrinks what crosses between components — shell
 * output into context, orchestrator into subagent, session into session.
 */
export const TOKEN_TOOLS = [
  { id: 'rtk', mandatory: true, channel: 'communication', needle: /\brtk\b/, requiredBy: /require_rtk/ },
  { id: 'icm', mandatory: true, channel: 'communication', needle: /\bicm\b/, requiredBy: /require_icm/ },
  {
    id: 'codebase-memory-mcp',
    mandatory: true,
    channel: 'communication',
    needle: /codebase-memory/,
    // Both patterns require the phase to open UNCONDITIONALLY — a top-level
    // `if`, not an `elif` hanging off a profile check — and the child
    // installer's failure to be fatal. The previous POSIX pattern literally
    // contained `PROFILE_INCLUDES_ADVANCED -eq 0`, so it accepted as proof of
    // obligation the very branch that skipped the install.
    requiredBy: /\nif \[\[ -f "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh" \]\]; then[\s\S]*?if ! bash "\$SCRIPT_DIR\/scripts\/install-codebase-memory\.sh"[\s\S]*?exit 1/,
    windowsRequiredBy: /\nWrite-Header "Phase 1\.8: Codebase Memory MCP"[\s\S]*?\$codebaseMemoryInstall[\s\S]*?catch \{[\s\S]*?exit 1/,
  },
  { id: 'toon', mandatory: true, channel: 'communication', needle: /toon|sanitize-subagent-payload/i, requiredBy: null },
  { id: 'context-tombstone', mandatory: true, channel: 'communication', needle: /context-tombstone|shrinkTurns/, requiredBy: null },
  { id: 'ast-skeletonizer', mandatory: true, channel: 'process', needle: /ast-skeletonizer|ast-lens/i, requiredBy: null },
  { id: 'context-arranger', mandatory: true, channel: 'process', needle: /context-arranger/, requiredBy: null },
  { id: 'synthesize-stubs', mandatory: true, channel: 'process', needle: /synthesize-stubs/, requiredBy: null },
  { id: 'diagnostic-distiller', mandatory: true, channel: 'process', needle: /diagnostic-distiller|distillTestOutput/, requiredBy: null },
  { id: 'mechanical-verify-union', mandatory: true, channel: 'process', needle: /mechanical-verify-union/, requiredBy: null },
  // Transport-level, so its wiring lives in .vscode/mcp.json rather than in
  // any prompt. Looking for it among the cycle surfaces was a category error:
  // no prompt will ever name the proxy its own MCP calls travel through.
  {
    id: 'mcp-compressor',
    mandatory: true,
    channel: 'communication',
    surface: 'transport',
    needle: /mcp-compressor/,
    requiredBy: /require_mcp_compressor/,
    // The POSIX setup uses an explicit require step; Windows must invoke the
    // equivalent installer rather than merely defining it.
    windowsRequiredBy: /^\s*(?:\$null\s*=\s*)?Install-McpCompressor\s*$/m,
  },
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

/**
 * True when a line does not merely NAME the tool but tells the agent to use it.
 *
 * The distinction is the whole point of this gate. A prompt saying "we removed
 * context-tombstone" contains the string and invokes nothing; counting it made
 * the gate certify a saving the product had dropped on purpose — the same
 * class of false green it exists to prevent, aimed at itself.
 *
 * The first attempt at the distinction looked for an imperative verb anywhere
 * on the line, and "do not **use** it" matched — a negation read as an order.
 * Detecting intent in prose by regex was the wrong instrument. So the rule is
 * positional instead: the tool name has to sit where a command sits — inside a
 * code span, inside a fenced block, or at the head of a shell line. Prose
 * about a tool, however emphatic, is not wiring.
 */
export function invokesTool(text, needle) {
  let inFence = false

  for (const line of String(text).split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }

    // Everything inside a fence is command text, except a shell comment.
    if (inFence) {
      if (!/^\s*#/.test(line) && needle.test(line)) return true
      continue
    }

    if (!needle.test(line)) continue

    // An inline code span is the markdown way of writing "this is a command".
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      if (needle.test(m[1])) return true
    }

    // A bare shell line: a list bullet or a `$` prompt may precede the binary.
    const bare = line.replace(/^\s*(?:[-*+]|\d+\.)\s*/, '').replace(/^\s*\$\s*/, '')
    if (/^(?:node|pnpm|npm|npx|yarn|bash|sh|uv|uvx|rtk|icm)\b/.test(bare) && needle.test(bare)) return true
  }

  return false
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

  // A transport tool is wired in the MCP config, not in prose. Searching for
  // it among the prompts would report it missing forever, which is a gate
  // that cries wolf rather than one that binds.
  const mcpRel = '.vscode/mcp.json'
  const mcpText = read(path.join(root, mcpRel))

  for (const tool of tools) {
    if (tool.surface === 'transport') {
      if (mcpText && tool.needle.test(mcpText)) map.get(tool.id).push(mcpRel)
      continue
    }
    for (const file of files) {
      // Mention is not invocation. A raw substring match counted a comment
      // saying "we used to use context-tombstone but removed it" as proof the
      // cycle invokes it — the gate would certify a saving the product had
      // deliberately dropped. Only prose the agent is meant to ACT on counts.
      if (invokesTool(read(file), tool.needle)) map.get(tool.id).push(path.relative(root, file))
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
  const setupPath = path.join(root, 'setup.sh')
  const windowsSetupPath = path.join(root, 'setup.ps1')
  // The installer-policy half of this audit only has an answer in the
  // development repository. An installed workspace has no `setup.sh` to read,
  // and asking there produced a gate that failed on every tool the installer
  // enforces — the loudest possible false alarm. The same strict/lenient split
  // that validate-srp and validate-test-globs already use applies here: in a
  // workspace the installer has already run, so wiring is what remains
  // checkable.
  const hasPosixSetup = fs.existsSync(setupPath)
  const hasWindowsSetup = fs.existsSync(windowsSetupPath)
  const isDevRepo = hasPosixSetup || hasWindowsSetup
  const setup = hasPosixSetup ? read(setupPath) : ''
  const windowsSetup = hasWindowsSetup ? read(windowsSetupPath) : ''
  const map = wiringMap(root, tools)
  const notMandatory = []
  const notWired = []
  const rows = []

  for (const tool of tools) {
    const where = map.get(tool.id) ?? []
    // A tool is enforced when the installer refuses to continue without it.
    // `requiredBy: null` means enforcement lives in the cycle rather than in
    // the installer, so wiring alone decides.
    const installerChecks = []
    if (tool.requiredBy && hasPosixSetup) installerChecks.push(tool.requiredBy.test(setup))
    if (tool.windowsRequiredBy && hasWindowsSetup) installerChecks.push(tool.windowsRequiredBy.test(windowsSetup))
    const enforced = !isDevRepo || installerChecks.length === 0 ? where.length > 0 : installerChecks.every(Boolean)

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
      return `  ${mark} ${r.id.padEnd(24)} ${pol} ${r.channel.padEnd(14)} invocada en ${r.sites} superficie(s)`
    })
    .join('\n')
}

function main() {
  const root = process.cwd()
  const r = auditTokenTools(root)

  const mode = fs.existsSync(path.join(root, 'setup.sh')) || fs.existsSync(path.join(root, 'setup.ps1'))
    ? 'estricto (repo)'
    : 'laxo (workspace instalado)'
  console.log('=== AOI Token-Saving Tool Coverage ===\n')
  console.log(`Modo: ${mode}\n`)
  console.log(formatToolTable(r.rows))
  console.log('\nToda herramienta de ahorro es obligatoria en TODO perfil; Headroom es la única excepción. "Invocada" cuenta prompts, agentes,')
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
