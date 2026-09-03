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

| Gate                | From → To            | Who Approves | What Must Exist                                           |
| ------------------- | -------------------- | ------------ | --------------------------------------------------------- |
| Intent Gate         | Pre-Flight → Explore | Owner        | BIC (Behavioral Intent Contract) calibrated               |
| Proposal Gate       | Explore → Specify    | Owner        | `proposal.md` with acceptance criteria                    |
| Design Gate         | Specify → Plan     | Owner        | `spec.md` approved, no ambiguity                          |
| Implementation Gate | Plan → Implement   | Owner        | `design.md` + `tasks.md` complete                         |
| TDD Gate            | During Implement   | Agent        | RED (failing test) → GREEN (min code) → REFACTOR per task |
| UX Gate             | During Implement   | @ux-designer | UI component review before any new UI                     |
| Verify Gate         | Implement → Verify | Automatic    | All tasks marked done                                     |
| Archive Gate        | Verify → Archive   | Owner        | `verify-report.md` with PASS/FAIL                         |

> **Note on Design Gate**: The Design Gate (Specify→Plan, Owner approval) is satisfied jointly with the Implementation Gate at the end of `/sdd-ff`. The Supervisor's `/sdd-ff` command bundles Specify → Plan → Tasks into a single workflow with one Owner approval checkpoint, which serves as both the Design Gate and Implementation Gate. This is a deliberate optimization, not a violation.

## Pre-Flight (/sdd-frame) vs. Explore (/sdd-new) — When to Use Which

`/sdd-frame` and `/sdd-new` serve distinct purposes in the lifecycle and are fully decoupled. Entering `/sdd-frame` is **optional**:

| Dimension | `/sdd-frame` (Pre-Flight) | `/sdd-new` (Explore & Propose) |
| --------- | ------------------------- | ------------------------------ |
| **Space** | **Problem Space**: Understands the pain, outcomes, and invariants. | **Solution Space**: Explores code, architecture, and technical feasibility. |
| **Disk Footprint** | **Zero-Task Footprint**: No task ID, no `.tasks/` folders, no registry pollution. | **Materialized**: Allocates `TASK-YYYY-NNN`, creates task directory, registers in `.tasks/registry.md`. |
| **Input Format** | Natural language (voice, conversational text, raw business notes). | Structured requirement or calibrated BIC from `/sdd-frame`. |
| **Output** | Behavioral Intent Contract (BIC) / ephemeral intent canvas. | `proposal.md` with technical architecture & acceptance criteria. |
| **Gate** | **Intent Gate**: Owner approves mental model and "Never" rules. | **Proposal Gate**: Owner approves technical approach to enter `/sdd-ff`. |

### Decision Guide: Which Command to Start With?

- **Use `/sdd-frame` first when:**
  - The requirement is expressed in informal natural language or open business ideas.
  - You want to verify in O(1) against ICM facts if the capability already exists before committing a task ID.
  - You need socratic probing to surface hidden boundaries, "Never" rules (invariants), and measurable success oracles.
- **Go directly to `/sdd-new` when:**
  - The requirement is already mature, crisp, and technically bounded in your mind.
  - It is a concrete technical improvement, refactor, or feature with well-known boundaries.
  - You want to immediately mint `TASK-YYYY-NNN`, run the mandatory Service Discovery Gate, and generate `proposal.md`.

## Handling Bugs, Adjustments & Definition Gaps

Not every issue requires a new BIC or a new `/sdd-new` task. Classify into 3 operational scenarios:

| Scenario | Diagnosis | Action | Lifecycle Impact |
| -------- | --------- | ------ | ---------------- |
| **1. Technical Bug** | Code violates an existing invariant or contract (crashes, regressions, wrong math). | Invoke `@triage-specialist`. Root cause diagnosis ➔ failing test (RED) ➔ code fix (GREEN) ➔ verify. | **0 New SDD Tasks**. Handled in place within the affected component. |
| **2. Invariant Gap / Business Rule** | Code did what was asked, but business uncovers an unhandled domain rule or edge case. | Invoke `/sdd-frame`. Socratic dialogue in natural language to calibrate the new invariant & oracle. | **Intent Evolution**. Updates existing BIC or creates a new calibrated BIC for `/sdd-new`. |
| **3. Minor Tweak / Config** | Cosmetic adjustment, label change, timeout tweak, env variable update. | **Direct Fix with Test** or ICM Fact update (`icm facts set "{WS}.config.key" "val"`). | **0 Ceremony**. Strict KISS/YAGNI to prevent token waste. |

### Decision Rule
- *Broken behavior against existing rules?* ➔ `@triage-specialist` (diagnosis & TDD fix).
- *Need to add or modify a business rule/invariant?* ➔ `/sdd-frame` (calibrate intent in natural language).
- *Parameter, static copy, or trivial tweak?* ➔ Direct fix with test / ICM Fact (zero overhead).

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

| Phase      | Topic                              | What to Store                                         |
| ---------- | ---------------------------------- | ----------------------------------------------------- |
| Pre-Flight | —                                  | Zero-Task Footprint (efímero en diálogo socrático)    |
| Explore    | `sdd-{WS}-{FEATURE}-TASK-YYYY-NNN` | User intent, constraints, service discovery           |
| Specify   | same                               | Formal specs, acceptance criteria                     |
| Plan      | same + `{WS}-architecture`         | Design decisions, tradeoffs, component graph          |
| Implement | same                               | Progress checkpoints, error resolutions               |
| Verify    | same + `{WS}-errors-resolved`      | QA findings, spec drift, health audit                 |
| Archive   | same + `{WS}-session-summaries`    | Final decisions, what was excluded, closure rationale |
