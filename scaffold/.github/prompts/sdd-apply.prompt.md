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

### Step 2: Identify Task + Validate Pre-Conditions (Context-Agnostic Resolution)

Resolve the target TASK-ID automatically using the following priority order (do NOT interrupt or ask if context is available):

1. **Explicit Argument**: If `{{input}}` contains an explicit TASK-ID (e.g. `TASK-2026-001`), validate and use it.
2. **Current Conversation Context**: If a task was just planned in `/sdd-ff` within the active session, use that TASK-ID automatically.
3. **Recent Registry Inference**: If `{{input}}` is empty, "continua", "procede", "adelante", "dale", "aplica", or similar confirmation:
   - Read `.tasks/registry.md` and pick the most recent task with status `🏗️ Planificado`.
   - Announce briefly: `▸ Contexto auto-detectado: TASK-YYYY-NNN ({feature-name}) — Iniciando olas de ejecución autónoma...`
4. **Fallback**: Only if multiple planned tasks exist without prior conversation context, list active tasks and ask the Owner to select one.

5. Read `.tasks/{feature-name}/TASK-YYYY-NNN/tasks.md`
6. Read `.tasks/{feature-name}/TASK-YYYY-NNN/implementation-plan.md`
7. Read `.tasks/{feature-name}/TASK-YYYY-NNN/design.md` for architecture context

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

### Step 3: Implement (via AOI-OS Autonomous Wave Engine)

Execute DAG execution waves using the deterministic AOI-OS engine:

```bash
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply
```

The engine executes in parallel waves and automatically applies:
1. **ASCII DAG Progress Visualization**: Prints wave structure and active micro-agent roles.
2. **Incremental SHA-256 Audit Cache**: Optimizes repeated static proofs in $\mathcal{O}(1)$ time.
3. **AST Structural Syntactic Analyzer**: Ensures 100% delimiter balance (`{}`, `[]`, `()`) and valid exports.
4. **Supply Chain Dependency Guard**: Audits `package.json` against malicious install hooks and typosquatting.
5. **WCAG 2.1 AA A11y Guard**: Verifies accessibility attributes (`alt`, ARIA, `<label>`) in Vue SFCs and HTML.
6. **SQL Transaction Deadlock Guard**: Enforces canonical table locking orders.
7. **TDD Gate & Red-Green-Refactor**: Executes test suites per wave with automatic rollback on test failures.
8. **Memory Sinking**: Stores task completion states directly into ICM (`decisions-{workspace}`, `context-{workspace}`).

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
