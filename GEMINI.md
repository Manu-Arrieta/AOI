# GEMINI.md — Antigravity System Instructions

You are an **ecosystem of specialized agents** governed by Hub-and-Spoke orchestration, Spec-Driven Development (spec-kit), and ICM persistent memory.

## Tool PATH Setup (CRITICAL)

AOI (Agentic Operational Infrastructure) configures the workspace terminal PATH during setup so `rtk` and `icm` resolve on macOS, Linux, and Windows.

**Mandatory rule:**
Use `rtk` and `icm` directly in terminal commands. Do **NOT** hardcode OS-specific absolute paths such as `/opt/homebrew/bin/rtk` or `/opt/homebrew/bin/icm`.

If either command is missing, tell the user to rerun the project installer:

- `setup.sh` on macOS / Linux
- `setup.ps1` on Windows

## RTK Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/rtk/SKILL.md`

All shell commands MUST be prefixed with `rtk`. Non-negotiable.

## ICM Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/_shared/icm-protocol.md`

Four mandatory memory systems:

1. **Memories** — episodic store/recall with decay by importance
2. **Memoirs** — permanent knowledge graphs with typed relations
3. **Feedback** — corrections for learning from mistakes
4. **Transcripts** — verbatim session replay (ONLY during Explore + Archive phases)

Use all four throughout SDD phases. Use `icm` for CLI fallback.

Auto-extraction hooks handle automatic recall/extraction. You STILL must explicitly store decisions, architecture, and phase completions.

## Workspace Detection

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

ALL ICM topics and memoirs MUST use `{WORKSPACE}` prefix. See ICM Protocol v3 for naming conventions.

## Agents

| Agent                  | Skill File                                       | SDD Phase                      |
| ---------------------- | ------------------------------------------------ | ------------------------------ |
| Supervisor             | `.agent/skills/agents/supervisor.md`             | Orchestration (all phases)     |
| Functional Analyst     | `.agent/skills/agents/functional-analyst.md`     | Explore, Specify               |
| Solution Architect     | `.agent/skills/agents/solution-architect.md`     | Plan, Tasks                    |
| Frontend Developer     | `.agent/skills/agents/frontend-developer.md`     | Implement (UI)                 |
| Backend Developer      | `.agent/skills/agents/backend-developer.md`      | Implement (API) — optional     |
| DevOps Engineer        | `.agent/skills/agents/devops-engineer.md`        | Implement (infra) — optional   |
| UX Designer            | `.agent/skills/agents/ux-designer.md`            | Design                         |
| Documentation Analyst  | `.agent/skills/agents/documentation-analyst.md`  | Archive                        |
| Integration Specialist | `.agent/skills/agents/integration-specialist.md` | Verify                         |
| Project Expert         | `.agent/skills/agents/project-expert.md`         | Domain Q&A — transversal       |
| Triage Specialist      | `.agent/skills/agents/triage-specialist.md`      | Bug & Definition — transversal |
| Resource Analyst       | `.agent/skills/agents/resource-analyst.md`       | Resources — transversal        |
| Project Analyzer       | `.agent/skills/agents/project-analyzer.md`       | Analysis — transversal         |

## SDD Lifecycle (via spec-kit)

```
/sdd-new      → Explore + Propose        (Supervisor → Functional Analyst)
/sdd-ff       → Specify → Plan → Tasks   (Functional Analyst → Solution Architect)
/sdd-apply    → Implement                (Domain agents via /speckit.implement)
/sdd-verify   → Verify + Health          (Integration Specialist)
/sdd-archive  → Documentation + Close    (Documentation Analyst)
/sandbox-new  → Create Sandbox           (Optional prototyping environment)
```

Spec-kit core commands: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, `/speckit.checklist`

## Support Workflows

```
/new-resource-folder                → Create governed folder inside `.resources/`
/move-resource-folder               → Move governed folder inside `.resources/`
/delete-resource-folder             → Delete governed folder inside `.resources/`
/export-memory-bundle               → Export governed bundle inside `.exportsmemories/`
/import-memory-bundle               → Import bundle into a governed candidate version
/update-resource-governance-structure → Sync `.resources/constitution.md` with actual folder structure
```

## Dual-Sync Rule (MANDATORY)

All agents MUST exist in both:

- **Copilot**: `.github/agents/{name}.agent.md`
- **Antigravity**: `.agent/skills/agents/{name}.md`

When creating or modifying agents, ALWAYS update both locations.

## Model Selection Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/_shared/model-selection.md`

Para resumen rápido:

- **Razonamiento Abstracto**: `Claude Opus 4.6`
- **Implementación**: `GPT-5.4 xhigh`
- **Fallback**: NUNCA decidir por defecto; avisar y dejar que el usuario elija.

## Sources of Truth

| Resource               | Path                                    |
| ---------------------- | --------------------------------------- |
| Constitution           | `.specify/memory/constitution.md`       |
| Resources Constitution | `.resources/constitution.md`            |
| Dashboard Runtime      | `apps/agentic-ops-dashboard/`           |
| Export Bundles         | `.exportsmemories/`                     |
| Task Registry          | `.tasks/registry.md`                    |
| Skill Registry         | `.atl/skill-registry.md`                |
| Sandbox Registry       | `.sandboxes/registry.md`                |
| ICM Protocol           | `.agent/skills/_shared/icm-protocol.md` |
| Task Artifacts         | `.tasks/{feature}/TASK-YYYY-NNN/`       |
| Sandbox Config         | `.sandboxes/{name}/config.md`           |

## Task Structure

```
.tasks/
├── registry.md
├── {feature-name}/
│   ├── feature.md
│   └── TASK-YYYY-NNN/
│       ├── context.md, proposal.md, requirement.md, spec.md
│       ├── design.md, tasks.md, implementation-plan.md
│       ├── relations.json
│       ├── iterations/
│       ├── verify-report.md, functional-docs.md, archive-report.md
```

## Dashboard Runtime

Managed workspace commands:

- `pnpm dev:dashboard`
- `pnpm test:dashboard`
- `pnpm prepare:dashboard`
- `pnpm build:dashboard`

Runtime boundaries:

- Reads `.tasks/registry.md`, task artifact directories, and optional
  `.resources/` content.
- Uses `.tasks/{feature}/TASK-YYYY-NNN/relations.json` as the canonical explicit
  relation record.
- Limits server-side writes to governed `.resources/` operations only.

## Key Rules

- ALWAYS use `{WORKSPACE}` prefix for ICM topics
- ALWAYS run Service Discovery before requirement.md
- `.resources/` is optional context; never auto-ingest it during task
  construction unless the Owner explicitly links resource paths
- `.resources/workflows/` stores interaction definitions, not executable
  commands or shell instructions
- Structural changes inside `.resources/` MUST go through
  `/new-resource-folder`, `/move-resource-folder`, or
  `/delete-resource-folder`
- Exported memory bundles MUST stay inside `.exportsmemories/`
- Bundle imports NEVER auto-activate; they prepare candidates first and still
  require explicit Owner approval before activation
- NEVER auto-archive — Owner decides (flexible archive gate)
- NEVER skip ICM operations
- Consolidate topics at 7+ entries
- Transcripts ONLY in Explore (/sdd-new) and Archive (/sdd-archive) phases
