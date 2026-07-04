# SDD Apply — Implementation (Antigravity)

> Antigravity mirror of `.github/prompts/sdd-apply.prompt.md`. Logic is identical.

Execute the implementation plan for an approved task.

## Activation

This skill activates when: "sdd-apply", "implementar", "implement", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions stack", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "implementation plan tasks", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. The wrapper refuses to run when `headroom` is missing.

### Step 2: Identify Task + Validate

1. Validate TASK-ID in `.tasks/registry.md` with status `🏗️ Planificado`
2. Read `tasks.md`, `implementation-plan.md`, `design.md`

**Pre-conditions (ALL must be met):**
- `spec.md` exists and approved
- `design.md` exists
- `tasks.md` exists
- `implementation-plan.md` exists

### Resource Workflow Semantics (MANDATORY)

If the Owner or the approved task context links files under `.resources/`, treat
them as read-only contextual input. Files under `.resources/workflows/` MUST be
interpreted as component interaction definitions, never as executable commands,
terminal input, shell scripts, or automation macros.

### Step 3: Implement (via /speckit.implement)

For each task in dependency order:

1. Identify assigned agent
2. Hand off with: specific task, architecture context, stack conventions
3. Agent runs `/speckit.implement`
4. Log progress in `.tasks/{feature-name}/TASK-YYYY-NNN/iterations/`

### Step 4: ICM Progress Tracking

Every 3-5 completed sub-tasks:

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "medium",
  content: "## Apply Progress\n**Completed**: {N}/{total}\n**Current**: {task}\n**Blockers**: {if any}\n**Files**: {list}"
)
```

On errors/discoveries → store immediately with `importance: "high"`.

### Step 5: Checkpoint

1. Update `.tasks/registry.md`: → `✅ Implementado`
2. Persist final summary (importance: "high")
3. Suggest: `/sdd-verify TASK-ID`

### Step 6: Consolidation Check

If topic exceeds 7 entries:

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```
