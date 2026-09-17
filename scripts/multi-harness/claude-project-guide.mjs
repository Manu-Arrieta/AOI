/**
 * scripts/multi-harness/claude-project-guide.mjs
 *
 * The part of CLAUDE.md that describes the repository itself: what it is, how
 * to run it, and which gate will refuse a change.
 *
 * It lives in the compiler and not in `CLAUDE.md` because `CLAUDE.md` is not a
 * file anyone owns. `compile-rules` writes it with an unconditional
 * `writeFileSync` on every `aoi:sync-rules`, so anything typed into it is
 * deleted on the next compile — silently, with no conflict and no diff to
 * notice. Onboarding prose kept there is prose with an expiry date. Kept here
 * it is regenerated, which is the only way a generated surface can carry
 * knowledge at all.
 *
 * This matters twice over, because AOI is a bootstrapper: every installed
 * workspace receives these files through `scaffold/`, so a note written into
 * one workspace's `CLAUDE.md` helps exactly one workspace until its next sync,
 * and no other installation ever learns it.
 *
 * Split from `compile-rules.mjs` for the same reason `protocol-source.mjs`
 * was: that file sits close to the 300 LOC of Invariant 5, and a guide is the
 * kind of text that grows.
 *
 * What is deliberately NOT written here: the interaction graphs. A
 * prompt→script or module→module graph frozen into prose is wrong within a week
 * and nothing measures the drift. `aoi:graph`, `aoi:handoffs` and
 * `aoi:determinism` already emit those from the current tree in zero inference
 * tokens, so the guide names the generator instead of copying its output. Only
 * relationships no generator emits — command→gate, and the repository's own
 * identity — are spelled out.
 */

import fs from 'node:fs'
import path from 'node:path'

import { readInstalledProfile } from '../installation-profiles.mjs'

/**
 * Development repository or installed workspace?
 *
 * The marker is `setup.sh` at the root, the same one `validate-srp`,
 * `validate-test-globs` and `undocumented-commands` already branch on. The
 * guide states it because it silently changes what the gates audit, and an
 * agent that assumes the wrong one will draw the wrong conclusion from a green
 * run.
 */
export function isDevelopmentRepo(root) {
  return fs.existsSync(path.join(root, 'setup.sh'))
}

/** Renders the identity section, derived from the tree being compiled into. */
function renderIdentity(repoRoot) {
  const dev = isDevelopmentRepo(repoRoot)
  const profile = readInstalledProfile(repoRoot)

  if (dev) {
    return `This is the AOI **development repository** — \`setup.sh\` is present at the root.
It is agentic infrastructure, not an application: there is no product code here,
and \`scripts/\` **is** the system.

AOI is a bootstrapper. \`scaffold/\` is the payload every installed workspace
receives, so a change here propagates to every workspace installed from it. That
is the reason Principle I exists and why \`test:parity\` is not negotiable.

- Gates audit every file under \`scripts/\`, because all of it is AOI's own code.
- \`pnpm test\` is the contract this repository ships under. Run it before
  considering any infrastructure change finished.`
  }

  const dashboard = profile === 'dashboard'
    ? 'The `*:dashboard` commands run the auxiliary app under `aoi_apps/agentic-ops-dashboard`.'
    : `Installed profile is \`${profile}\` (\`.conf/manifest.json\`), so every \`*:dashboard\` command is a deliberate no-op that prints \`Dashboard … omitido\` and exits 0.`

  return `This is an **installed AOI workspace** — there is no \`setup.sh\` at the root.
AOI is agentic infrastructure: \`scripts/\` is the runtime, not product code.

**A defect found in \`scripts/\`, \`.github/\` or \`.specify/\` here is an upstream
defect.** These paths arrive from AOI's \`scaffold/\` and are overwritten on the
next install or sync, so a repair made here is lost and every other installation
keeps the bug. Fix it in the AOI development repository and let it propagate.

- Gates run in \`governedOnly\` mode: only files mirrored under \`scaffold/\` are
  audited, so a script added outside that set is not judged by Invariant 5.
- ${dashboard}`
}

/**
 * The repository guide appended to CLAUDE.md.
 * @param {{ workspace?: string, repoRoot?: string }} options
 */
export function renderProjectGuide({ workspace = 'AOI', repoRoot = process.cwd() } = {}) {
  return `
---

## What this repository is

${renderIdentity(repoRoot)}

## CLAUDE.md is compiled — never edit it by hand

\`aoi:sync-rules\` regenerates this file from
\`scripts/multi-harness/compile-rules.mjs\` with an unconditional write. Edits made
here are destroyed on the next compile, with no conflict and no warning. The same
holds for \`AGENTS.md\`, \`.cursorrules\`, \`.clinerules\`,
\`.cursor/rules/aoi-rules.mdc\`, \`.agents/rules/aoi-rules.md\` and
\`.github/copilot-instructions.md\`.

To change what this file says, edit the generator:

| To change | Edit |
| --- | --- |
| This guide | \`scripts/multi-harness/claude-project-guide.mjs\` |
| The ICM protocol blocks | \`.github/instructions/icm-protocol.instructions.md\` — every harness derives from it |
| The skeleton and the other dialects | \`scripts/multi-harness/compile-rules.mjs\` |

Then run \`pnpm aoi:sync-rules\`, which also refreshes the \`scaffold/\` mirror.

A \`commit-msg\` hook (\`.githooks/pre-commit-aoi-guard.sh\`) blocks any commit
touching those files unless the subject carries \`[aoi-managed-ok]\`. That block is
intended behaviour, not an obstacle to route around: it exists because
\`headroom learn --apply\` rewrites the same surfaces without AOI's knowledge.

## Commands

\`\`\`bash
pnpm test                 # the full chain: every gate, then every suite
pnpm aoi:doctor           # 360° health check, 0 inference tokens
pnpm aoi:sync-rules       # recompile all harness files + scaffold mirror
\`\`\`

While iterating, run one area's suite or one file rather than the whole chain:

\`\`\`bash
pnpm test:sdd-lifecycle                              # one area
node --test scripts/scaffold/validate-srp.test.mjs   # one file
node --test --test-name-pattern "ratchet" scripts/scaffold/validate-srp.test.mjs
\`\`\`

Read-only lenses. All deterministic; none of them needs a model:

\`\`\`bash
pnpm aoi:graph          # prompt→script→agent interaction graph (JSON)
pnpm aoi:handoffs       # SDD phase sequence and its artifact contract
pnpm aoi:determinism    # per-file determinism classification
pnpm aoi:ast-lens       # fold function bodies, keep signatures
\`\`\`

## Architecture

Ten areas under \`scripts/\`, each with its tests beside it:

| Area | Owns |
| --- | --- |
| \`sdd-lifecycle/\` | SDD phases, the Invariant and Blueprint gates, context budget, behavioural probes |
| \`multi-harness/\` | compiling one protocol into six assistant dialects; the prose linters |
| \`memory-sync/\` | versioned ICM memory: manifests, bundles, activation, rollback |
| \`scaffold/\` | the gates that judge AOI itself: parity, SRP, reachability, test globs, mutation |
| \`sandbox/\` | \`.sandboxes/\` manifests and base-project detection |
| \`code-lens/\` | the read-only lenses listed above |
| \`subagent-context/\` | sanitized subagent payloads, TOON serialization, context tombstoning |
| \`spatiotemporal-runtime/\` | Fiber lifecycle, revertible effects, coeffects, transactional HMR |
| \`mcp-gateway/\` | the MCP compression proxy and its zero-disabled-tools invariant |
| \`conf/\` | installed-workspace configuration AOI owns without overwriting the Owner's |

Do not mistake that table for the architecture. It is a taxonomy, and a taxonomy
hides the thing that actually matters — who calls whom, in what order. For the
real shape run \`pnpm aoi:graph\` and \`pnpm aoi:handoffs\`: they answer from the
current tree instead of from prose written once and never re-measured.

The governance spine is \`.specify/memory/constitution.md\` and its five
principles. Everything else enforces it: the prompts in \`.github/prompts/\` drive
the phases, the agents in \`.github/agents/\` are delegated to under
\`.github/instructions/agent-delegation.instructions.md\`, and the gates below
refuse the change when a principle is violated.

Task artifacts live at \`.tasks/{feature}/TASK-YYYY-NNN/\` — \`proposal.md\`,
\`spec.md\`, \`design.md\`, \`tasks.md\`, \`verify-report.md\` — indexed by
\`.tasks/registry.md\`, which every phase transition updates.

## Which gate refuses what

\`pnpm test\` runs these before any suite. Each is deterministic and costs no
inference tokens.

| Gate | Refuses |
| --- | --- |
| \`aoi:srp\` | a governed file over 300 LOC (Invariant 5), as a ratchet: recorded debt may only shrink |
| \`test:parity\` | any drift between a governed path and its \`scaffold/\` mirror (Principle I) |
| \`aoi:reachability\` | a source file no test ever loads |
| \`aoi:test-globs\` | a declared test glob matching nothing — a suite reporting green over zero assertions |
| \`aoi:lint-refs\` | prose naming a script or \`/command\` that does not exist |
| \`aoi:invariant-gate\` | a Behavioral Intent Contract invariant with no test asserting it |
| \`aoi:blueprint-gate\` | a System Blueprint Contract left unclosed, or missing its diagram |
| \`aoi:hooks\` | harness hooks declared but not wired into \`.claude/settings.json\` |

Adding a file under a governed path means mirroring it into \`scaffold/\` in the
same change, or \`test:parity\` fails. Adding one no test loads fails
\`aoi:reachability\`.

## Working conventions

- **Most of this tree is gitignored.** \`rg\` and \`fd\` find almost nothing without
  \`--no-ignore\`; use it by default here, or you will conclude a file is absent
  when it is merely ignored.
- \`compile-rules.mjs\` takes \`--workspace ${workspace}\`. Unknown flags fall back
  to defaults silently rather than erroring.
- ICM content passes through a shell: backticks inside it are command-substituted.
  Keep them out of \`icm store -c\` values.
- Comments in this codebase carry the measured defect that motivated the code,
  not a description of what the line does. When you change such a module, update
  its comment to match what is now true — a stale rationale is worse than none,
  because it is believed.
`
}
