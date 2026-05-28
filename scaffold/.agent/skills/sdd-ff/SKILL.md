# SDD Fast Forward — Specify → Plan → Tasks (Antigravity)

> Antigravity mirror of `.github/prompts/sdd-ff.prompt.md`. Logic is identical.

Take an approved proposal and produce implementation-ready task breakdowns.

## Activation

This skill activates when: "sdd-ff", "fast forward", "planificar", "specify", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions stack", topic: "{WORKSPACE}-context")
```

### Step 2: Identify Task

1. If TASK-ID provided → validate in `.tasks/registry.md`
2. If not → show active tasks, ask Owner to pick
3. Read `.tasks/{feature-name}/TASK-YYYY-NNN/proposal.md`
4. Recall: `icm_memory_recall(query: "exploration", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")`
5. If `.tasks/{feature-name}/TASK-YYYY-NNN/relations.json` exists, treat it as
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

### Step 3: Specify (via Functional Analyst + /speckit.specify)

1. Functional Analyst reads `proposal.md` and any `requirement.md`
2. Runs `/speckit.specify` to generate formal spec
3. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/spec.md`
4. Runs `/speckit.clarify` if ambiguities detected
5. Persist: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Spec produced: {summary}")`

### Step 4: Plan (via Solution Architect + /speckit.plan)

1. Solution Architect reads `spec.md` + recalls architecture
2. Runs `/speckit.plan` to generate design
3. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/design.md`
4. Architecture decisions → Memoirs:
   ```
   icm_memoir_add_observation(memoir: "{WORKSPACE}-architecture", observation: "TASK-YYYY-NNN: {decision}", connections: ["component-a", "component-b"])
   ```

### Step 5: Tasks (via Solution Architect + /speckit.tasks)

1. Runs `/speckit.tasks` for implementable task breakdown
2. Output → `.tasks/{feature-name}/TASK-YYYY-NNN/tasks.md`
3. Produces `implementation-plan.md`: agent assignment, dependency order, criteria
4. Persist: `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high", content: "Tasks: N tasks across K agents")`
5. Update `.tasks/registry.md`: status → `🏗️ Planificado`

### Step 6: Gate — Owner Approval

> "TASK-YYYY-NNN ready. Spec, design, N tasks. Approve for `/sdd-apply TASK-ID`."

- Approved → suggest `/sdd-apply`
- Changes → re-run affected step
- Cancelled → update registry, persist reason
