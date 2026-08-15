---
description: "Execute implementation tasks from the approved plan using spec-kit implement."
agent: "agent"
---

# /sdd-apply — Implementation

Execute the implementation plan for an approved task.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions stack", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "implementation plan tasks", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. The wrapper refuses to run when `headroom` is missing.

### Step 1b: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record implementation decisions and mid-flight changes verbatim. This captures rationale for approach changes, blockers encountered, and Owner decisions during the longest SDD phase.

### Step 2: Identify Task + Validate Pre-Conditions

Resolve the TASK-ID from user input `{{input}}`:

1. Validate it exists in `.tasks/registry.md` with status `🏗️ Planificado`
2. Read `.tasks/{feature-name}/TASK-YYYY-NNN/tasks.md`
3. Read `.tasks/{feature-name}/TASK-YYYY-NNN/implementation-plan.md`
4. Read `.tasks/{feature-name}/TASK-YYYY-NNN/design.md` for architecture context

**Pre-conditions (ALL must be met):**

- `spec.md` exists and is approved
- `design.md` exists
- `tasks.md` exists with task breakdown
- `implementation-plan.md` exists with agent assignments

**On pre-conditions met**: Update `.tasks/registry.md` status → `⚙️ En Implementación` immediately before starting implementation.

### Resource Workflow Semantics (MANDATORY)

If the Owner or the approved task context links files under `.resources/`, treat
them as read-only contextual input. Files under `.resources/workflows/` MUST be
interpreted as component interaction definitions, never as executable commands,
terminal input, shell scripts, or automation macros.

### Step 3: Implement (via /speckit.implement)

> 🛡️ **TDD Gate**: Every implementation agent MUST follow RED → GREEN → REFACTOR per task.
> No production code without a failing test first. Enforced internally by @frontend-developer,
> @backend-developer, and @devops-engineer.

For each task in the implementation plan, in dependency order:

1. Identify the assigned agent (frontend-dev, backend-dev, etc.)
2. Hand off to that agent using an **Isolated Subagent Payload** (via `node scripts/subagent-context/sanitize-subagent-payload.mjs --task-dir .tasks/{feature}/{task-id} --role {role}` or extracted slice):
   - The specific task and test requirements (TDD) from `tasks.md`
   - Target architecture contracts and interfaces from `design.md`
   - Stack conventions from constitution
   - **Context Isolation Rule**: Do NOT pass full multi-turn conversational history to the subagent prompt.
3. Agent runs `/speckit.implement` to execute (TDD Gate enforced internally)
4. **Implementation Principles Review** — after each task, the implementing agent verifies:
   - **SRP**: No new file exceeds ~300 LOC. If it does, justify or split.
   - **DRY**: No code was copy-pasted from another module. If logic is shared, extract to a common utility.
   - **KISS**: No abstraction was introduced with only one implementation. Remove unnecessary layers.
   - **Fail Fast**: Public functions validate their inputs at entry. No silent failures.
   - **Composition over Inheritance**: No inheritance hierarchy >2 levels deep. Prefer composition.
   - **Law of Demeter**: No method chains like `a.b.c.d()`. Talk only to direct collaborators.
   - **Immutability**: Use `const`/`readonly`/`final` where possible. Mutable state only when necessary.
   - **Security**: Inputs validated, outputs encoded. No hardcoded secrets. SQL parameterized.
### AOI-OS Autonomous Mode (`--os-mode`)

When running with `--os-mode` or invoking AOI-OS runtime:
1. Delegate DAG wave compilation and autonomous execution directly to the AOI-OS engine:
   ```bash
   node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply
   ```
2. The engine autonomously:
   - Compiles task dependency graph and parallel execution waves.
   - Synthesizes ephemeral micro-agents with strict capability whitelists.
   - Stages file modifications in isolated sandboxes (`.sandboxes/aoi-os-tmp-{taskId}`).
   - Enforces Polyglot AST Contract Guards (C#, TS, Vue, Python).
   - Arbitrates Consensus Gates (OWASP security, secrets & <300 LOC rules).
   - Auto-heals test diagnostics via circuit breaker rollback if needed.
   - Sinks semantic memory graph nodes directly into ICM (`decisions-{workspace}`, `errors-resolved`, `context-{workspace}`).

### Step 4: ICM Progress Tracking

Every 3-5 completed sub-tasks, persist progress:

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "medium",
  content: "## Apply Progress\n**Completed**: {N}/{total} tasks\n**Current**: {task_name}\n**Blockers**: {if any}\n**Files modified**: {list}"
)
```

On errors/discoveries, store immediately with `importance: "high"`.

### Step 5: Implementation Checkpoint

After all tasks are complete:

1. Update `.tasks/registry.md`: status → `⚙️ En Implementación` → `✅ Implementado`
2. Persist final summary in ICM:
   ```
   icm_memory_store(
     topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
     importance: "high",
     content: "## Implementation Complete\n**Tasks**: {N}/{N}\n**Files**: {list}\n**Key decisions**: {list}\n**Ready for**: /sdd-verify"
   )
   ```
3. Suggest: `/sdd-verify TASK-ID`

### Step 6: Consolidation Check

If ICM warns about topic exceeding 7 entries:

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

**The task to implement is:**
{{input}}
