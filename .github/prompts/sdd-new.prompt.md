---
description: "Start a new SDD cycle. Explores requirements, creates proposal, and kicks off specification."
mode: "agent"
---

# /sdd-new — Explore + Propose

Start a new Spec-Driven Development cycle for a feature or change.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

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

Present the recalled context to the user briefly.

### Step 2: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record every user message and agent response during this phase. Transcripts capture the Owner's original intent — this context is lost when Memories summarize it.

### Step 3: Determine Feature + Task

1. Read `.tasks/registry.md` for the last TASK-ID used
2. Ask the Owner: _"Does this belong to an existing feature or is it new?"_
3. If **new feature**: create `.tasks/{feature-name}/feature.md` with metadata
4. Generate `TASK-YYYY-NNN` with current year and next sequential number
5. Create directory `.tasks/{feature-name}/TASK-YYYY-NNN/`
6. Create `.tasks/{feature-name}/TASK-YYYY-NNN/context.md` with initial state
7. If the Owner explicitly linked files under `.resources/`, create or update
  `.tasks/{feature-name}/TASK-YYYY-NNN/relations.json`
8. Register in `.tasks/registry.md`

### Step 4: Service Discovery Gate (MANDATORY)

Before exploring the requirement, search for existing services:

```
icm_memory_recall(query: "services composables endpoints", topic: "{WORKSPACE}-services-catalog")
```

Also scan the codebase for existing services, composables, utils, API endpoints that may be relevant. Persist any discoveries:

```
icm_memory_store(
  topic: "{WORKSPACE}-services-catalog",
  importance: "high",
  content: "**Service**: path/to/composable\n**Endpoint**: METHOD /path (operationId: xxx)\n**Resolves**: [business problem]\n**Discovered in**: TASK-YYYY-NNN",
  keywords: "service,{operationId}"
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
- Paths MUST NOT be inferred from free text or proposal prose.
- If no `.resources/` files were explicitly linked, `relations.json` remains
  optional and MUST NOT be fabricated.

### Step 5: Explore

Investigate the codebase before committing to the change:

1. Read relevant files (only what's needed — don't inflate context)
2. Identify: current system state, impacted areas, reusable patterns, stack constraints
3. Analyze alternative approaches with tradeoffs
4. Consult OpenAPI spec if the feature involves backend data

Persist in ICM:

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "## Exploration: {topic}\n### Current State\n{...}\n### Impacted Areas\n{...}\n### Approaches\n1. {Name} — pros/cons/effort\n2. {Name} — pros/cons/effort\n### Recommendation\n{...}\n### Risks\n{...}"
)
```

### Step 6: Propose

With the exploration analysis, produce the proposal:

1. Recover explore from ICM
2. Write `.tasks/{feature-name}/TASK-YYYY-NNN/proposal.md`
3. Persist summary in ICM
4. Update registry: status → `📋 Propuesto`

### Step 7: Gate — Owner Approval

Present the proposal to the Owner. Ask:

> "Proposal ready for TASK-YYYY-NNN. Approve to proceed to planning (/sdd-ff), or request changes?"

- If approved → hand off to **@functional-analyst** for `requirement.md`, then suggest `/sdd-ff TASK-ID`
- If changes requested → iterate the proposal
- If cancelled → update registry to `❌ Cancelado`, persist reason in ICM

**The change to start is:**
{{input}}
