---
description: "Verify implementation against spec, run health checks, and decide on archive or continue."
agent: "agent"
---

# /sdd-verify — Verification

Verify that the implementation meets the specification and all quality gates.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "implementation complete", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. The wrapper refuses to run when `headroom` is missing.

### Step 2: Identify Task + Load Artifacts (Context-Agnostic Resolution)

Resolve the target TASK-ID automatically using the following priority order (do NOT interrupt or ask if context is available):

1. **Explicit Argument**: If `{{input}}` contains an explicit TASK-ID (e.g. `TASK-2026-001`), validate and use it.
2. **Current Conversation Context**: If a task was just executed in `/sdd-apply` within the active session, use that TASK-ID automatically.
3. **Recent Registry Inference**: If `{{input}}` is empty, "continua", "procede", "adelante", "verifica", or similar confirmation:
   - Read `.tasks/registry.md` and pick the most recent task with status `✅ Implementado` or `⚙️ En Implementación`.
   - Announce briefly: `▸ Contexto auto-detectado: TASK-YYYY-NNN ({feature-name}) — Ejecutando auditoría de calidad y cumplimiento...`
4. **Fallback**: Only if multiple implemented tasks exist without prior conversation context, list active tasks and ask the Owner to select one.

5. Load all artifacts from `.tasks/{feature-name}/TASK-YYYY-NNN/`:
   - `spec.md` (the contract)
   - `design.md` (architecture decisions)
   - `tasks.md` (what was planned)
   - `implementation-plan.md` (agent assignments)

### Resource Workflow Semantics Check (MANDATORY)

If implementation artifacts or execution logs reference files under
`.resources/workflows/`, verify they were used only as contextual interaction
definitions. Any evidence that those files were treated as executable commands,
terminal input, shell scripts, or automation macros is an automatic FAIL.

### Step 3: Spec Compliance Check

Hand off to **@integration-specialist** with isolated task context (via `node scripts/subagent-context/sanitize-subagent-payload.mjs --task-dir .tasks/{feature}/{task-id} --role qa` or task artifacts):

1. For each requirement in `spec.md`, verify implementation exists
2. For each constraint in `design.md`, verify it was respected
3. For each task in `tasks.md`, verify completion
4. **TDD Gate compliance**: confirm tests exist and pass for all implementation tasks. To verify:
   - Read each task's `## Test Requirements` section from `tasks.md`
   - Detect test runner from project stack: `npm test`, `pnpm test`, `pytest`, `go test ./...`, `dotnet test`, etc.
   - Run the test suite and capture output. If tests fail → include failures in verify-report as FAIL reason
   - If no test files exist for a task that specified test requirements → mark as TDD FAIL
5. **Software Principles Gate** — review all new/modified files and report violations:
   - **SRP**: Any file >300 LOC? → WARNING (justify or recommend split)
   - **DIP**: Circular imports between modules? → WARNING
   - **DRY**: Code blocks duplicated across 2+ files (>10 lines similar)? → WARNING
   - **Fail Fast**: Empty `catch` blocks or silenced errors? → WARNING
   - **Security**: Hardcoded secrets, API keys, or passwords? → FAIL. Unparameterized SQL? → FAIL. Also: read `proposal.md` `## Principles Assessment` — verify that security threats identified during `/sdd-new` have mitigations in the implementation.
   - **Observability**: Read `design.md` Observability section — verify that logs/metrics/traces specified in design were actually implemented. New endpoints/controllers without logging? → WARNING
   - **Contract-First**: Read `spec.md` for API contracts defined — verify that interfaces/types/endpoints match the spec. Breaking changes from spec? → WARNING
   Include findings in verify-report under `## Principles Compliance`.
6. Run `/speckit.checklist` for formal verification
7. **Mechanical Set Union Consolidation**: When consolidating multiple verification reports (test failures, lint violations, type errors), use deterministic Set Union aggregation (via `node scripts/sdd-lifecycle/mechanical-verify-union.mjs`) instead of paying for an LLM fuser/evaluator step.

### Step 4: Service Discovery Gate Check

Verify that Service Discovery was performed during `/sdd-new`:

```
icm_memory_recall(query: "services discovered TASK-YYYY-NNN", topic: "{WORKSPACE}-services-catalog")
```

If NO evidence of service discovery → **automatic FAIL** with note:

> "Service Discovery Gate was not completed during /sdd-new. This is a mandatory step."

### Step 5: Sandbox Manifest Gate (active sandbox only)

If the task under verification has an **active sandbox** — a `.sandboxes/{name}/`
directory that contains an `integration-manifest.json` — run the manifest
validator:

```bash
node scripts/sandbox/validate-manifest.mjs .sandboxes/{name}/integration-manifest.json
```

- **Non-zero exit code → automatic FAIL gate.** Verification CANNOT pass. Capture
  the validator's `stderr` message verbatim into the Verify Report as the failure
  reason. This gate has the same severity as the Resource Workflow Semantics and
  Service Discovery FAIL gates.
- **Exit 0 → continue.** Then read the manifest `elements[]` and, for **each**
  element whose `disposition` is `integrate` AND whose `status` is `pending`,
  emit one **migration-plan line**. Resolve the element's `target` token —
  written as `{rootKey}:{relative-path}` where `rootKey ∈ {frontend, backend,
sharedLibs}` — against `.specify/memory/base-project.json` by looking up
  `roots[{rootKey}]` to produce the real base-project path (FR-10).
  Example: `auth-form` with `target: "frontend:aoi_apps/agentic-ops-dashboard/app/components/AuthForm.vue"`
  resolves `frontend` via `base-project.json.roots.frontend` → the concrete
  destination path under the base project.
- Elements with any other `disposition` (`discard`, `visualization-only`,
  `undecided`) or any other `status` are **excluded** from the migration plan.

If there is **no active sandbox**, skip this step — it is not applicable and is
not a failure. The resulting migration-plan lines feed the Verify Report (Step 7)
and the `@integration-specialist` rules from Step 3.

### Step 6: ICM Memory Health Audit

```
icm_memory_health()
```

Check for:

- Topics with 7+ entries needing consolidation → run `icm_memory_consolidate` immediately
- Stale entries → flag for review
- Missing critical topics → warn

### Step 7: Produce Verify Report

Write `.tasks/{feature-name}/TASK-YYYY-NNN/verify-report.md`:

```markdown
# Verify Report — TASK-YYYY-NNN

## Result: {PASS | FAIL | PARTIAL}

## Spec Compliance

| Requirement | Status | Evidence                 |
| ----------- | ------ | ------------------------ |
| ...         | ✅/❌  | file:line or description |

## Architecture Compliance

- [ ] Design decisions respected
- [ ] No drift from `design.md`

## Quality Gates

- [ ] Service Discovery completed (mandatory)
- [ ] Sandbox manifest valid — `validate-manifest.mjs` exit 0 (if active sandbox)
- [ ] ICM Memory Health OK
- [ ] No orphan tasks in `tasks.md`

## Migration Plan (active sandbox only)

| Element | Disposition | Status  | Resolved Target                            |
| ------- | ----------- | ------- | ------------------------------------------ |
| ...     | integrate   | pending | {base path resolved via base-project.json} |

## Issues Found

{list or "None"}

## Recommendation

{PASS → archive | FAIL → iterate | PARTIAL → owner decision}
```

### Step 8: ICM Persist

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "## Verify: {PASS|FAIL|PARTIAL}\n{summary of findings}"
)
```

### Step 9: Flexible Archive Gate — Owner Decision

Present results to the Owner and offer choices:

> "TASK-YYYY-NNN verification: {RESULT}. What would you like to do?"

| Option              | When                            | Action                                                       |
| ------------------- | ------------------------------- | ------------------------------------------------------------ |
| **Archive**         | PASS — feature is done          | → `/sdd-archive TASK-ID`                                     |
| **Continue**        | PASS but Owner wants to iterate | → keep status `🔄 Sandbox Activo`, Owner drives next changes |
| **Fix + Re-verify** | FAIL or PARTIAL                 | → back to `/sdd-apply` for fixes, then re-verify             |
| **Cancel**          | Owner abandons                  | → status `❌ Cancelado`, persist reason                      |

**The Owner decides.** The Supervisor does NOT auto-archive on PASS.

**The task to verify is:**
{{input}}
