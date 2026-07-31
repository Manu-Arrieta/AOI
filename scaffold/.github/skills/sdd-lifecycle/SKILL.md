---
name: sdd-lifecycle
description: Spec-Driven Development lifecycle conventions — phases, artifacts, gates, task numbering, and workflow rules shared across all SDD agents. Use when running any /sdd-* command, creating tasks, or routing work through SDD phases.
---

# SDD Lifecycle — Conventions & Rules

Every agent in the AOI ecosystem follows these lifecycle rules. This skill is the single source of truth for SDD mechanics — it describes HOW the lifecycle works, not what any specific agent does.

## Task Numbering (TASK-YYYY-NNN)

Every task gets a unique ID: `TASK-{year}-{sequential}`

```
.tasks/{feature-name}/TASK-2026-001/
├── proposal.md         # Explore phase output
├── spec.md             # Specify phase output
├── design.md           # Plan phase output
├── tasks.md            # Task breakdown
├── implementation-plan.md  # Cross-agent assignment map
├── iterations/         # Implement phase artifacts
├── verify-report.md    # QA & verification output
├── archive-report.md   # Closure & documentation
└── functional-docs.md  # Generated user-facing docs
```

## Phase Gates — MANDATORY

| Gate                | From → To          | Who Approves | What Must Exist                                           |
| ------------------- | ------------------ | ------------ | --------------------------------------------------------- |
| Proposal Gate       | Explore → Specify  | Owner        | `proposal.md` with acceptance criteria                    |
| Design Gate         | Specify → Plan     | Owner        | `spec.md` approved, no ambiguity                          |
| Implementation Gate | Plan → Implement   | Owner        | `design.md` + `tasks.md` complete                         |
| TDD Gate            | During Implement   | Agent        | RED (failing test) → GREEN (min code) → REFACTOR per task |
| UX Gate             | During Implement   | @ux-designer | UI component review before any new UI                     |
| Verify Gate         | Implement → Verify | Automatic    | All tasks marked done                                     |
| Archive Gate        | Verify → Archive   | Owner        | `verify-report.md` with PASS/FAIL                         |

## Rules ALL Agents Must Follow

### Before Starting Any Phase

1. Recall ICM context for the phase: `icm_memory_recall(query: "pending tasks", topic: "sdd-{WORKSPACE}")`
2. Check feedback for past mistakes: `icm_feedback_search(query: "{phase}")`
3. Read the constitution: `.specify/memory/constitution.md`

### During Work

- Every 3-5 tool calls or sub-tasks → store a checkpoint in ICM
- Architecture decisions → BOTH `icm_memory_store` (episodic) AND `icm_memoir_add_concept` (graph)
- Errors encountered → `icm_feedback_record` immediately

### After Completing a Phase

- `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", importance: "high")`
- If topic has 7+ entries → `icm_memory_consolidate(topic)` immediately

## Scaffold Mirror Rule

Any change to agents, skills, instructions, or prompts in `.github/` MUST be mirrored to `scaffold/.github/` in the same commit. The `verify-report.md` checks this automatically.

## ICM Topics Per Phase

| Phase     | Topic                              | What to Store                                         |
| --------- | ---------------------------------- | ----------------------------------------------------- |
| Explore   | `sdd-{WS}-{FEATURE}-TASK-YYYY-NNN` | User intent, constraints, service discovery           |
| Specify   | same                               | Formal specs, acceptance criteria                     |
| Plan      | same + `{WS}-architecture`         | Design decisions, tradeoffs, component graph          |
| Implement | same                               | Progress checkpoints, error resolutions               |
| Verify    | same + `{WS}-errors-resolved`      | QA findings, spec drift, health audit                 |
| Archive   | same + `{WS}-session-summaries`    | Final decisions, what was excluded, closure rationale |
