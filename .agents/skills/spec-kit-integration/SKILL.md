---
name: spec-kit-integration
description: Spec-Kit (specify CLI) integration — available commands, template conventions, agent routing, and artifact expectations. Use when running any /speckit.* command or when generating spec/plan/tasks artifacts.
---

# Spec-Kit Integration — Commands, Templates & Conventions

Spec-Kit provides the structured artifact generation layer for SDD. This skill describes what spec-kit commands do, what templates they use, and how agents route through them.

## Available Commands

| Command                   | Agent                   | Input                        | Output                                |
| ------------------------- | ----------------------- | ---------------------------- | ------------------------------------- |
| `/speckit.constitution`   | @speckit.constitution   | Principles from Owner        | `.specify/memory/constitution.md`     |
| `/speckit.specify`        | @speckit.specify        | `proposal.md` + Owner intent | `spec.md`                             |
| `/speckit.clarify`        | @speckit.clarify        | `spec.md`                    | Refined `spec.md` (up to 5 questions) |
| `/speckit.plan`           | @speckit.plan           | `spec.md`                    | `design.md`                           |
| `/speckit.tasks`          | @speckit.tasks          | `design.md`                  | `tasks.md`                            |
| `/speckit.analyze`        | @speckit.analyze        | spec + plan + tasks          | Cross-artifact consistency report     |
| `/speckit.checklist`      | @speckit.checklist      | User requirements            | Custom checklist                      |
| `/speckit.implement`      | @speckit.implement      | `tasks.md`                   | Working code                          |
| `/speckit.taskstoissues`  | @speckit.taskstoissues  | `tasks.md`                   | GitHub issues                         |
| `/speckit.git.initialize` | @speckit.git.initialize | —                            | Git repo                              |
| `/speckit.git.feature`    | @speckit.git.feature    | Feature name                 | Feature branch                        |
| `/speckit.git.commit`     | @speckit.git.commit     | Changes                      | Auto-commit                           |
| `/speckit.git.validate`   | @speckit.git.validate   | Branch name                  | Validation                            |
| `/speckit.git.remote`     | @speckit.git.remote     | —                            | Remote URL                            |

## Templates

All templates live in `.specify/templates/`:

| Template                   | Used By               | Purpose                       |
| -------------------------- | --------------------- | ----------------------------- |
| `spec-template.md`         | @speckit.specify      | Functional spec structure     |
| `plan-template.md`         | @speckit.plan         | Architecture design structure |
| `tasks-template.md`        | @speckit.tasks        | Dependency-ordered task list  |
| `checklist-template.md`    | @speckit.checklist    | Custom checklist format       |
| `constitution-template.md` | @speckit.constitution | Project constitution          |
| `agent-file-template.md`   | @supervisor           | Agent definition format       |

## Agent Routing Protocol

The Supervisor routes spec-kit work following these rules:

1. **Constitution first**: before any feature work, `.specify/memory/constitution.md` must exist
2. **Service Discovery**: @functional-analyst MUST search ICM for existing services before writing requirements
3. **Sequential dependency**: specify → plan → tasks (never skip)
4. **Clarify is optional**: only run `/speckit.clarify` when spec has ambiguities
5. **Analyze is optional**: run after tasks.md for quality check
6. **Implement routes to specialists**: @frontend-developer for UI, @backend-developer for API, @devops-engineer for infra
7. **UX Gate**: @ux-designer review before any new UI component

## Artifact Conventions

### spec.md MUST contain

- Existing surface discovery (services, agents, templates affected)
- Scaffold-mirror sync impact
- Tooling/platform impact (RTK, ICM, Specify, setup, OS)
- Functional requirements with acceptance criteria
- Edge cases and error scenarios

### design.md MUST contain

- Constitution check (scaffold-mirror, ICM, RTK, cross-platform)
- Component/service diagram
- Data flow
- API contracts (if applicable)
- Validation strategy

### tasks.md MUST contain

- Dependency-ordered task list
- Each task: actionable, testable, assignable to one agent
- Scaffold-mirror tasks when `.github/` or `scaffold/` changes
- Registry/documentation maintenance tasks

## Integration Configuration

`.specify/integration.json` registers available integrations. `.specify/integrations/` contains manifests:

- `speckit.manifest.json` — spec-kit tool manifest
- `copilot.manifest.json` — Copilot integration

The `specify` CLI is installed during setup and provides the `/speckit.*` command namespace.

## Model Requirements for Spec-Kit Agents

All spec-kit reasoning agents use **DeepSeek V4 Pro** (Primary) with **NVIDIA** fallback. `speckit.implement` and speckit git agents use **GLM 5.2** (Primary) with **NVIDIA** fallback. See `.github/instructions/model-selection.instructions.md` for the full table.
