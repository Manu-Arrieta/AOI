<!-- AOI / CLAUDE.md — Auto-compiled by aoi:sync-rules -->
# AOI — Agentic Operational Infrastructure (AOI)

## Persistent Memory (ICM v0.10+ Protocol v4) — MANDATORY

This project operates with **Infinite Context Memory (ICM)**. You MUST use it actively.

### Recall (Before Starting Any Task)
```bash
icm wake-up                              # Instant deterministic facts pack
icm recall "query"                        # Search episodic memories (cross-topic)
icm list --topic "<topic>"                # READ stored context: reliable, deterministic
icm recall "query" -t "AOI-context"        # Filter by topic — EMPTY if the topic misses the global top-K cut
icm facts list "AOI"             # O(1) exact project facts
```

### Store Triggers (MANDATORY) — derivado de `.github/instructions/icm-protocol.instructions.md`

`icm store -t <topic> -c "<description>" -i <importance>` · topics: `AOI-decisions`,
`AOI-context`, `AOI-errors-resolved`, `AOI-preferences`.

- `-i critical` → project stack o contexto · decisión de arquitectura · convención establecida · preferencia del Owner (topic `AOI-preferences`)
- `-i high` → spec o plan producido · tarea completada · reporte de QA o verify · error resuelto (topic `AOI-errors-resolved`)
- `-i medium` → progreso de implementación, checkpoint cada 3-5 tareas
- `-i low` → notas de exploración, ideas temporales (se podan solas)

Configuración exacta como hecho O(1): `icm facts set "AOI" "key" "value"`.

### Workspace Health Diagnostic (0 Tokens)
```bash
pnpm aoi:doctor                          # 360° Repository health check
```

### SDD Workflow Commands (Read from .github/prompts/<command>.prompt.md)
- `/init` — Bootstrap project, ICM facts, and base project map (`.github/prompts/init.prompt.md`)
- `/sdd-genesis` — Phase -2: co-design an abstract idea into a System Blueprint Contract (SBC) (`.github/prompts/sdd-genesis.prompt.md`)
- `/sdd-frame` — Pre-Flight: Socratic dialogue in natural language & Behavioral Intent Contract (BIC) (`.github/prompts/sdd-frame.prompt.md`)
- `/sdd-new` — Explore domain, discover services, and author proposal (`.github/prompts/sdd-new.prompt.md`)
- `/sdd-ff` — Fast-Forward: specify → plan → tasks with TDD requirements (`.github/prompts/sdd-ff.prompt.md`)
- `/sdd-apply` — Implement planned tasks with TDD & Fiber sandboxes (`.github/prompts/sdd-apply.prompt.md`)
- `/sdd-verify` — Verify implementation, test gates, Invariant Gate, and SRP limits (<300 LOC) (`.github/prompts/sdd-verify.prompt.md`)
- `/sdd-archive` — Close task, distill patterns, and refresh fast briefings (`.github/prompts/sdd-archive.prompt.md`)

---

## What this repository is

This is the AOI **development repository** — `setup.sh` is present at the root.
It is agentic infrastructure, not an application: there is no product code here,
and `scripts/` **is** the system.

AOI is a bootstrapper. `scaffold/` is the payload every installed workspace
receives, so a change here propagates to every workspace installed from it. That
is the reason Principle I exists and why `test:parity` is not negotiable.

- Gates audit every file under `scripts/`, because all of it is AOI's own code.
- `pnpm test` is the contract this repository ships under. Run it before
  considering any infrastructure change finished.

## CLAUDE.md is compiled — never edit it by hand

`aoi:sync-rules` regenerates this file from
`scripts/multi-harness/compile-rules.mjs` with an unconditional write. Edits made
here are destroyed on the next compile, with no conflict and no warning. The same
holds for `AGENTS.md`, `.cursorrules`, `.clinerules`,
`.cursor/rules/aoi-rules.mdc`, `.agents/rules/aoi-rules.md` and
`.github/copilot-instructions.md`.

To change what this file says, edit the generator:

| To change | Edit |
| --- | --- |
| This guide | `scripts/multi-harness/claude-project-guide.mjs` |
| The ICM protocol blocks | `.github/instructions/icm-protocol.instructions.md` — every harness derives from it |
| The skeleton and the other dialects | `scripts/multi-harness/compile-rules.mjs` |

Then run `pnpm aoi:sync-rules`, which also refreshes the `scaffold/` mirror.

A `commit-msg` hook (`.githooks/pre-commit-aoi-guard.sh`) blocks any commit
touching those files unless the subject carries `[aoi-managed-ok]`. That block is
intended behaviour, not an obstacle to route around: it exists because
`headroom learn --apply` rewrites the same surfaces without AOI's knowledge.

## Commands

```bash
pnpm test                 # the full chain: every gate, then every suite
pnpm aoi:doctor           # 360° health check, 0 inference tokens
pnpm aoi:sync-rules       # recompile all harness files + scaffold mirror
```

While iterating, run one area's suite or one file rather than the whole chain:

```bash
pnpm test:sdd-lifecycle                              # one area
node --test scripts/scaffold/validate-srp.test.mjs   # one file
node --test --test-name-pattern "ratchet" scripts/scaffold/validate-srp.test.mjs
```

Read-only lenses. All deterministic; none of them needs a model:

```bash
pnpm aoi:graph          # prompt→script→agent interaction graph (JSON)
pnpm aoi:handoffs       # SDD phase sequence and its artifact contract
pnpm aoi:determinism    # per-file determinism classification
pnpm aoi:ast-lens       # fold function bodies, keep signatures
```

## Architecture

10 areas under `scripts/`, each with its tests beside it:

| Area | Owns |
| --- | --- |
| `code-lens/` | the read-only lenses listed above |
| `conf/` | installed-workspace configuration AOI owns without overwriting the Owner's |
| `mcp-gateway/` | the MCP compression proxy and its zero-disabled-tools invariant |
| `memory-sync/` | versioned ICM memory: manifests, bundles, activation, rollback |
| `multi-harness/` | compiling one protocol into six assistant dialects; the prose linters |
| `sandbox/` | `.sandboxes/` manifests and base-project detection |
| `scaffold/` | the gates that judge AOI itself: parity, SRP, reachability, test globs, mutation |
| `sdd-lifecycle/` | SDD phases, the Invariant and Blueprint gates, context budget, behavioural probes |
| `spatiotemporal-runtime/` | Fiber lifecycle, revertible effects, coeffects, transactional HMR |
| `subagent-context/` | sanitized subagent payloads, TOON serialization, context tombstoning |

Do not mistake that table for the architecture. It is a taxonomy, and a taxonomy
hides the thing that actually matters — who calls whom, in what order. For the
real shape run `pnpm aoi:graph` and `pnpm aoi:handoffs`: they answer from the
current tree instead of from prose written once and never re-measured.

The governance spine is `.specify/memory/constitution.md` and its five
principles. Everything else enforces it: the prompts in `.github/prompts/` drive
the phases, the agents in `.github/agents/` are delegated to under
`.github/instructions/agent-delegation.instructions.md`, and the gates below
refuse the change when a principle is violated.

Task artifacts live at `.tasks/{feature}/TASK-YYYY-NNN/` — `proposal.md`,
`spec.md`, `design.md`, `tasks.md`, `verify-report.md` — indexed by
`.tasks/registry.md`, which every phase transition updates.

## Which gate refuses what

`pnpm test` runs these before any suite. Each is deterministic and costs no
inference tokens.

| Gate | Refuses |
| --- | --- |
| `aoi:srp` | a governed file over 300 LOC (Invariant 5), as a ratchet: recorded debt may only shrink |
| `test:parity` | any drift between a governed path and its `scaffold/` mirror (Principle I) |
| `aoi:reachability` | a source file no test ever loads |
| `aoi:test-globs` | a declared test glob matching nothing — a suite reporting green over zero assertions |
| `aoi:lint-refs` | prose naming a script or `/command` that does not exist |
| `aoi:entry-points` | a script the prose invokes that answers `node <path>` with exit 0 and no output — the line is there and the tool does not respond |
| `aoi:invariant-gate` | a Behavioral Intent Contract invariant with no test asserting it |
| `aoi:blueprint-gate` | a System Blueprint Contract left unclosed, or missing its diagram |
| `aoi:hooks` | harness hooks declared but not wired into `.claude/settings.json` |

Adding a file under a governed path means mirroring it into `scaffold/` in the
same change, or `test:parity` fails. Adding one no test loads fails
`aoi:reachability`.

## Working conventions

- **Most of this tree is gitignored, and most of it is hidden.** For files use
  `fd -H -I` — two flags: `-H` for dot-directories, `-I` for ignored ones. Here
  `.md` files count 60 without them and 1356 with. For content use
  `rtk proxy rg --no-ignore`: bare `rg` is rewritten to `grep` by the RTK hook, and
  `grep` rejects `--no-ignore` outright, so the plain form cannot be followed.
- `compile-rules.mjs` takes `--workspace AOI`. Unknown flags fall back
  to defaults silently rather than erroring.
- ICM content passes through a shell: backticks inside it are command-substituted.
  Keep them out of `icm store -c` values.
- Comments in this codebase carry the measured defect that motivated the code,
  not a description of what the line does. When you change such a module, update
  its comment to match what is now true — a stale rationale is worse than none,
  because it is believed.
