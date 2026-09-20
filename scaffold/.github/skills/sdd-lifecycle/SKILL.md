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

<!-- Sin la columna From → To: la secuencia de fases esta entera en la tabla de ruteo del supervisor. No la repongas. -->
| Gate | Who Approves | What Must Exist |
| --- | --- | --- |
| Genesis Gate | Owner | SBC closed per `blueprint-gate.mjs` (0 tokens); global invariants + boundary crossings persisted as O(1) facts |
| Intent Gate | Owner | BIC calibrated; invariants + oracle persisted as O(1) facts |
| Proposal Gate | Owner | `proposal.md` with acceptance criteria |
| Design Gate | Owner | `spec.md` approved, no ambiguity |
| Implementation Gate | Owner | `design.md` + `tasks.md` complete |
| TDD Gate | Agent | RED (failing test) → GREEN (min code) → REFACTOR per task |
| UX Gate | @ux-designer | UI component review before any new UI |
| Invariant Gate | Automatic | Every BIC `never`/`oracle` tag asserted by a test (`invariant-gate.mjs`, 0 tokens) |
| Verify Gate | Automatic | All tasks marked done |
| Archive Gate | Owner | `verify-report.md` with PASS/FAIL |

> **Note on Design Gate**: The Design Gate (Specify→Plan, Owner approval) is satisfied jointly with the Implementation Gate at the end of `/sdd-ff`. The Supervisor's `/sdd-ff` command bundles Specify → Plan → Tasks into a single workflow with one Owner approval checkpoint, which serves as both the Design Gate and Implementation Gate. This is a deliberate optimization, not a violation.

## Entrada al ciclo

`/sdd-genesis` cuando lo que hay es una **idea abstracta** y todavía no existe arquitectura que la contenga
(produce un SBC, y de él salen varios BIC);
`/sdd-frame` cuando la intención llega en lenguaje natural y hay que destilar invariantes;
`/sdd-new` cuando el requerimiento ya está acotado. Detalle en la skill `sdd-entry`.

## Handling Bugs, Adjustments & Definition Gaps

No todo problema requiere un BIC nuevo ni una tarea `/sdd-new`. El diagnóstico detallado de
los tres escenarios vive en `@triage-specialist`, que carga exactamente cuando hace falta.
Lo que se necesita en cualquier fase es saber a dónde enrutar:

### Decision Rule
- *Broken behavior against existing rules?* ➔ `@triage-specialist` (diagnosis & TDD fix).
- *Abstract idea, no architecture yet?* ➔ `/sdd-genesis` (co-design down to a System Blueprint Contract).
- *Need to add or modify a business rule/invariant?* ➔ `/sdd-frame` (calibrate intent in natural language).
- *Parameter, static copy, or trivial tweak?* ➔ Direct fix with test / ICM Fact (zero overhead).

## Rules ALL Agents Must Follow

Read the constitution (`.specify/memory/constitution.md`) before opening a phase.
The per-phase ICM triggers live in `icm-protocol.instructions.md` §8 and the
Supervisor's Hub-and-Spoke Protocol.

## Scaffold Mirror Rule

Any change to agents, skills, instructions, or prompts in `.github/` MUST be mirrored to `scaffold/.github/` in the same commit. The `verify-report.md` checks this automatically.

## ICM Topics Per Phase

| Phase | Topic | What to Store |
| --- | --- | --- |
| Pre-Flight | — | Zero-Task Footprint (efímero en diálogo socrático) |
| Explore | `sdd-{WS}-{FEATURE}-TASK-YYYY-NNN` | User intent, constraints, service discovery |
| Specify | same | Formal specs, acceptance criteria |
| Plan | same + `{WS}-architecture` | Design decisions, tradeoffs, component graph |
| Implement | same | Progress checkpoints, error resolutions |
| Verify | same + `{WS}-errors-resolved` | QA findings, spec drift, health audit |
| Archive | same + `{WS}-session-summaries` | Final decisions, what was excluded, closure rationale |
