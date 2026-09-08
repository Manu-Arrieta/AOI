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
4. **[conditional]** @functional-analyst runs `/speckit.clarify` if ambiguities are detected
5. **[conditional]** @functional-analyst runs `/speckit.checklist` if the contract is non-trivial — that is, if `/speckit.clarify` fired, or the BIC declares more than one Never Rule (`icm facts list "{WORKSPACE}" -p "bic." --read-only`). It validates the QUALITY OF THE SPEC ITSELF — unit tests for the requirements prose: are they unambiguous, complete, testable? This is the only phase where the answer is actionable: fixing an ambiguous requirement here costs one line, after `/sdd-apply` it costs a rewrite. It does NOT verify implementation; the deterministic gates in `/sdd-verify` do that.
   > **Por qué condicional.** Es el artefacto más caro del ciclo. Un contrato de una sola invariante que salió sin ambigüedades no tiene prosa que auditar, y correrlo ahí gasta sin encontrar nada. Un contrato que necesitó aclaración ya demostró que su redacción no era clara, y ahí sí paga. Ambas señales existen sin costo de inferencia: si `/speckit.clarify` corrió, y el conteo O(1) de Never Rules en ICM.
6. Persist in ICM: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Spec produced: {summary}")`

### Step 4: Plan (via @solution-architect + /speckit.plan)

Hand off to the **@solution-architect**:

1. @solution-architect reads `spec.md` + recalls architecture from ICM/Memoirs
2. Runs `/speckit.plan` to generate the architecture design
3. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/design.md`
4. Architecture decisions persisted to Memoirs:
   ```
   icm_memoir_add_concept(
     memoir: "{WORKSPACE}-architecture",
     name: "TASK-YYYY-NNN: {decision title}",
     definition: "{dense decision summary + rationale}",
     labels: "type:decision,task:TASK-YYYY-NNN"
   )
   ```
   Then link it to each affected component (one call per edge):
   ```
   icm_memoir_link(
     memoir: "{WORKSPACE}-architecture",
     from: "TASK-YYYY-NNN: {decision title}",
     to: "{component-name}",
     relation: "depends_on"
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
5. **BIC Contract Seeding (if the task came from `/sdd-frame`)**: Read the calibrated contract in O(1) with `icm facts list "{WORKSPACE}" -p "bic."`. Each Never Rule and the Oracle MUST become a named test in `## Test Requirements`, and the test name MUST carry its tag verbatim (`{BIC-ID}:never.{N}`, `{BIC-ID}:oracle`). `/sdd-verify` fails the task otherwise.
6. Persist in ICM: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Tasks generated: N tasks across K waves")`
7. Update `.tasks/registry.md`: status → `🏗️ Planificado`

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

