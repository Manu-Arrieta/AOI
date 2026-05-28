# SDD Verify — Verification (Antigravity)

> Antigravity mirror of `.github/prompts/sdd-verify.prompt.md`. Logic is identical.

Verify implementation against spec, run health checks, and present options to Owner.

## Activation

This skill activates when: "sdd-verify", "verificar", "verify", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "implementation complete", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

### Step 2: Identify Task + Load Artifacts

1. Validate in `.tasks/registry.md` with status `✅ Implementado`
2. Load: `spec.md`, `design.md`, `tasks.md`, `implementation-plan.md`

### Resource Workflow Semantics Check (MANDATORY)

If implementation artifacts or execution logs reference files under
`.resources/workflows/`, verify they were used only as contextual interaction
definitions. Any evidence that those files were treated as executable commands,
terminal input, shell scripts, or automation macros is an automatic FAIL.

### Step 3: Spec Compliance Check

Via Integration Specialist:

1. Each requirement in `spec.md` → verify implementation
2. Each constraint in `design.md` → verify respected
3. Each task in `tasks.md` → verify completion
4. Run `/speckit.checklist`

### Step 4: Service Discovery Gate Check

```
icm_memory_recall(query: "services discovered TASK-YYYY-NNN", topic: "{WORKSPACE}-services-catalog")
```

If NO evidence → **automatic FAIL**: "Service Discovery Gate not completed during /sdd-new."

### Step 5: ICM Memory Health Audit

```
icm_memory_health()
```

- Topics with 7+ entries → consolidate immediately
- Stale entries → flag
- Missing critical topics → warn

### Step 6: Produce Verify Report

Write `.tasks/{feature-name}/TASK-YYYY-NNN/verify-report.md` with: Result (PASS/FAIL/PARTIAL), Spec Compliance table, Architecture Compliance, Quality Gates, Issues Found, Recommendation.

### Step 7: ICM Persist

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "## Verify: {RESULT}\n{summary}"
)
```

### Step 8: Flexible Archive Gate — Owner Decision

> "TASK-YYYY-NNN verification: {RESULT}. What would you like to do?"

| Option | When | Action |
|--------|------|--------|
| **Archive** | PASS — done | → `/sdd-archive` |
| **Continue** | PASS but iterate | → `🔄 Sandbox Activo` |
| **Fix + Re-verify** | FAIL/PARTIAL | → back to `/sdd-apply` |
| **Cancel** | Abandon | → `❌ Cancelado` |

**The Owner decides.** Supervisor does NOT auto-archive.
