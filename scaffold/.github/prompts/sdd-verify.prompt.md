---
description: "Verify implementation against spec, run health checks, and decide on archive or continue."
mode: "agent"
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

### Step 5: ICM Memory Health Audit

```
icm_memory_health()
```

Check for:
- Topics with 7+ entries needing consolidation → run `icm_memory_consolidate` immediately
- Stale entries → flag for review
- Missing critical topics → warn

### Step 6: Produce Verify Report

Write `.tasks/{feature-name}/TASK-YYYY-NNN/verify-report.md`:

```markdown
# Verify Report — TASK-YYYY-NNN

## Result: {PASS | FAIL | PARTIAL}

## Spec Compliance
| Requirement | Status | Evidence |
|-------------|--------|----------|
| ... | ✅/❌ | file:line or description |

## Architecture Compliance
- [ ] Design decisions respected
- [ ] No drift from `design.md`

## Quality Gates
- [ ] Service Discovery completed (mandatory)
- [ ] ICM Memory Health OK
- [ ] No orphan tasks in `tasks.md`

## Issues Found
{list or "None"}

## Recommendation
{PASS → archive | FAIL → iterate | PARTIAL → owner decision}
```

### Step 7: ICM Persist

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "## Verify: {PASS|FAIL|PARTIAL}\n{summary of findings}"
)
```

### Step 8: Flexible Archive Gate — Owner Decision

Present results to the Owner and offer choices:

> "TASK-YYYY-NNN verification: {RESULT}. What would you like to do?"

| Option | When | Action |
|--------|------|--------|
| **Archive** | PASS — feature is done | → `/sdd-archive TASK-ID` |
| **Continue** | PASS but Owner wants to iterate | → keep status `🔄 Sandbox Activo`, Owner drives next changes |
| **Fix + Re-verify** | FAIL or PARTIAL | → back to `/sdd-apply` for fixes, then re-verify |
| **Cancel** | Owner abandons | → status `❌ Cancelado`, persist reason |

**The Owner decides.** The Supervisor does NOT auto-archive on PASS.

**The task to verify is:**
{{input}}
