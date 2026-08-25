---
description: "Fast-Forward from proposal to implementation-ready tasks. Runs specify → plan → tasks using spec-kit."
agent: "agent"
---

# /sdd-ff — Fast Forward (Specify → Plan → Tasks)

Take an approved proposal and produce implementation-ready task breakdowns.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions stack", topic: "{WORKSPACE}-context")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. The wrapper refuses to run when `headroom` is missing.

### Step 1b: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record architecture and design decisions verbatim during specify/plan/tasks. These capture the Owner's rationale that is lost when Memories summarize.

### Step 2: Identify Task (Context-Agnostic Resolution)

Resolve the target TASK-ID automatically using the following priority order (do NOT interrupt or ask if context is available):

1. **Explicit Argument**: If `{{input}}` contains an explicit TASK-ID (e.g. `TASK-2026-001`), validate and use it.
2. **Current Conversation Context**: If a task was just created or discussed in `/sdd-new` within the active session, use that TASK-ID automatically.
3. **Recent Registry Inference**: If `{{input}}` is empty, "continua", "procede", "adelante", "dale", "next", or similar confirmation:
   - Read `.tasks/registry.md` and pick the most recent task with status `📋 Propuesto` (or latest active task).
   - Announce briefly: `▸ Contexto auto-detectado: TASK-YYYY-NNN ({feature-name}) — Continuando hacia especificación y diseño...`
4. **Fallback**: Only if `.tasks/registry.md` has multiple ambiguous proposed tasks and no conversational context exists, list active tasks and ask the Owner to pick one.

5. Read `.tasks/{feature-name}/TASK-YYYY-NNN/proposal.md` for context
6. If `.tasks/{feature-name}/TASK-YYYY-NNN/requirement.md` exists, read it as @functional-analyst output from `/sdd-new`. If missing, proceed with `proposal.md` context.
7. Recall exploration from ICM: `icm_memory_recall(query: "exploration", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")`
8. If `.tasks/{feature-name}/TASK-YYYY-NNN/relations.json` exists, treat it as
  the canonical explicit relation record for linked `.resources/` files

### Resource Linkage Rule (MANDATORY)

Only consume files under `.resources/` when the Owner explicitly links those
paths as part of the planning request or previously approved task context. You
MUST NOT auto-load `.resources/`, and planning artifacts remain valid even when
no resources are provided.

If the approved task context or current planning request explicitly links files
under `.resources/`, you MUST preserve or extend
`.tasks/{feature-name}/TASK-YYYY-NNN/relations.json`.

- Paths under `.resources/userstories/` belong in `userstories`.
- Paths under `.resources/workflows/` belong in `workflows`.
- Do not infer relation entries from free text or existing artifact prose.
- If no explicit `.resources/` links exist, do not create synthetic relations.

### Step 3: Specify (via @functional-analyst + /speckit.specify)

Hand off to the **@functional-analyst** to formalize the specification:

1. @functional-analyst reads `proposal.md` and any `requirement.md`
2. Runs `/speckit.specify` to generate the formal spec
3. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/spec.md`
4. @functional-analyst runs `/speckit.clarify` if ambiguities are detected
5. Persist in ICM: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Spec produced: {summary}")`

### Step 4: Plan (via @solution-architect + /speckit.plan)

Hand off to the **@solution-architect**:

1. @solution-architect reads `spec.md` + recalls architecture from ICM/Memoirs
2. Runs `/speckit.plan` to generate the architecture design
3. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/design.md`
4. Architecture decisions persisted to Memoirs:
   ```
   icm_memoir_add_observation(
     memoir: "{WORKSPACE}-architecture",
     observation: "TASK-YYYY-NNN: {decision summary}",
     connections: ["component-a", "component-b"]
   )
   ```
5. **Architecture Principles Gate** — `design.md` MUST address:
   - **SRP**: Each component/module has one clear responsibility. If a module name requires "and", split it.
   - **OCP**: Document extension points — where can new behavior be added without modifying existing code?
   - **DIP**: Dependency direction — high-level modules must NOT depend on low-level modules directly. Both depend on abstractions.
   - **Contract-First**: Verify API contracts, types/interfaces, and schemas match with zero drift.
   - **Sequence Diagram**: Embed a Mermaid sequence diagram (`sequenceDiagram`) showing interaction flows between components and execution roles.
   - **Observability**: What needs to be logged, measured, or traced? Document in design.md: "Observability: {logs/metrics/traces needed}"

### Step 5: Tasks (via @solution-architect + /speckit.tasks)

Continue with @solution-architect:

1. Runs `/speckit.tasks` to break down the design into implementable tasks
2. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/tasks.md`
3. Produces `implementation-plan.md` with: agent assignment, dependency order, verification criteria
4. **TDD Gate**: Every task in `tasks.md` MUST include a `## Test Requirements` section specifying: (a) what tests to write first (RED), (b) acceptance criteria for GREEN, and (c) any refactor notes. Implementation agents enforce RED → GREEN → REFACTOR per task during `/sdd-apply`.
5. Persist in ICM: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Tasks generated: N tasks across K waves")`
6. Update `.tasks/registry.md`: status → `🏗️ Planificado`

### Step 6: Gate — Owner Approval

Present the complete plan to the Owner:

> "TASK-YYYY-NNN is implementation-ready. Spec, design, and N tasks generated across K waves. Review the artifacts and approve to proceed with `/sdd-apply TASK-ID`."

Show:
- Summary of spec changes & linked user stories
- Key architecture decisions & Mermaid sequence diagram
- Task count and role assignments

- If approved → suggest `/sdd-apply TASK-ID`
- If changes requested → iterate (re-run the affected step)
- If cancelled → update registry, persist reason

**The task to fast-forward is:**
{{input}}

