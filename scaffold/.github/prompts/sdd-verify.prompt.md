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

### Step 2: Identify Task + Load Artifacts

Resolve the TASK-ID from user input `{{input}}`:

1. Validate it exists in `.tasks/registry.md` with status `✅ Implementado`
2. Load all artifacts from `.tasks/{feature-name}/TASK-YYYY-NNN/`:
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

Hand off to **@integration-specialist**:

1. For each requirement in `spec.md`, verify implementation exists
2. For each constraint in `design.md`, verify it was respected
3. For each task in `tasks.md`, verify completion
4. Run `/speckit.checklist` for formal verification

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
