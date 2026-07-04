# SDD New — Explore + Propose (Antigravity)

> Antigravity mirror of `.github/prompts/sdd-new.prompt.md`. Logic is identical.

Start a new Spec-Driven Development cycle for a feature or change.

## Activation

This skill activates when the user says: "sdd-new", "nueva tarea", "new task", "explorar", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "project context stack conventions", topic: "{WORKSPACE}-context")
icm_memoir_search(memoir: "{WORKSPACE}-architecture", query: "current architecture")
icm_feedback_search(query: "requirements specification")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. Direct `copilot` invocations are forbidden by AOI bootstrap. The wrapper refuses to run when `headroom` is missing.

### Step 2: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record every user message and agent response. Captures Owner's original intent.

### Step 3: Determine Feature + Task

1. Read `.tasks/registry.md` for last TASK-ID
2. Ask Owner: "Does this belong to an existing feature or is it new?"
3. If new feature: create `.tasks/{feature-name}/feature.md`
4. Generate `TASK-YYYY-NNN` (current year + next sequential)
5. Create `.tasks/{feature-name}/TASK-YYYY-NNN/` directory
6. Create `.tasks/{feature-name}/TASK-YYYY-NNN/context.md`
7. If the Owner explicitly linked files under `.resources/`, create or update
  `.tasks/{feature-name}/TASK-YYYY-NNN/relations.json`
8. Register in `.tasks/registry.md`

### Step 4: Service Discovery Gate (MANDATORY)

```
icm_memory_recall(query: "services composables endpoints", topic: "{WORKSPACE}-services-catalog")
```

Scan codebase for existing services, composables, utils, API endpoints. Persist discoveries:

```
icm_memory_store(
  topic: "{WORKSPACE}-services-catalog",
  importance: "high",
  content: "**Service**: path/to/composable\n**Endpoint**: METHOD /path (operationId: xxx)\n**Resolves**: [business problem]\n**Discovered in**: TASK-YYYY-NNN"
)
```

**Without evidence of this step in ICM, `/sdd-verify` emits automatic FAIL.**

### Resource Linkage Rule (MANDATORY)

If the Owner explicitly links one or more files under `.resources/`, you MAY use
them as read-only contextual input during exploration. You MUST NOT auto-read
`.resources/` by default, and the absence of resource links MUST NOT block task
creation, proposal authoring, or downstream SDD phases.

### Explicit Relation Record Rule (MANDATORY when `.resources/` files are explicitly linked)

If the Owner explicitly links one or more files under `.resources/`, you MUST
create or update `.tasks/{feature-name}/TASK-YYYY-NNN/relations.json` after the
task directory exists.

```json
{
  "userstories": [],
  "workflows": []
}
```

- Paths under `.resources/userstories/` MUST be stored in `userstories`.
- Paths under `.resources/workflows/` MUST be stored in `workflows`.
- Paths MUST NOT be inferred from free text.
- If no `.resources/` files were explicitly linked, `relations.json` remains
  optional and MUST NOT be fabricated.

### Step 5: Explore

1. Read relevant files (only what's needed)
2. Identify: current state, impacted areas, reusable patterns, stack constraints
3. Analyze alternatives with tradeoffs
4. Consult OpenAPI spec if relevant

Persist in ICM:

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "## Exploration\n### Current State\n...\n### Impacted Areas\n...\n### Approaches\n1. pros/cons\n2. pros/cons\n### Recommendation\n...\n### Risks\n..."
)
```

### Step 6: Propose

1. Recover explore from ICM
2. Write `.tasks/{feature-name}/TASK-YYYY-NNN/proposal.md`
3. Persist summary in ICM
4. Update registry: status → `📋 Propuesto`

### Step 7: Gate — Owner Approval

> "Proposal ready for TASK-YYYY-NNN. Approve to proceed (/sdd-ff), or request changes?"

- Approved → suggest handoff to Functional Analyst then `/sdd-ff TASK-ID`
- Changes → iterate proposal
- Cancelled → `❌ Cancelado`, persist reason
