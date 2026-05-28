# Implementation Plan: Resource Governance

**Branch**: `2026-001-resource-governance` | **Date**: 2026-05-26 | **Spec**: `.tasks/resource-governance/TASK-2026-001/spec.md`
**Input**: Feature specification from `.tasks/resource-governance/TASK-2026-001/spec.md`

## Summary

This plan introduces `.resources/` as an installed, governed subsystem for
optional task-construction context. The implementation must add the default
resource tree, amend governance to permit a subordinate resources constitution,
introduce three administrative workflows for folder lifecycle, harden prompt
language so resources are never auto-ingested or executed, and keep root,
Antigravity, `scaffold/`, installer, registry, and documentation surfaces in
sync.

## Technical Context

**Language/Version**: Markdown, Bash, PowerShell 7+, repository configuration  
**Primary Dependencies**: Spec-kit workflow prompts, Antigravity skills, ICM
CLI protocol, RTK shell rules, scaffold copy/install flow  
**Storage**: Repository files plus workspace-scoped ICM memories and memoirs  
**Testing**: Focused prompt and registry validation, Markdown validation,
installer smoke checks, ICM-command presence checks  
**Target Platform**: VS Code workspaces on macOS, Linux, and Windows 11+  
**Project Type**: Agentic infrastructure template  
**Performance Goals**: No automatic `.resources/` ingestion during task
construction; resource-administration workflows complete in a single command
cycle with explicit ICM persistence  
**Constraints**: Dual-sync for shared surfaces, root constitution remains the
top authority, `userstories/` and `workflows/` remain default folders,
setup/teardown symmetry, no executable interpretation of workflow resources  
**Scale/Scope**: Shared workflow, constitution, registry, scaffold, docs, and
installer updates across both Copilot and Antigravity surfaces

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design is applied.*

- Dual-sync scope is explicit for every change touching `.github/`, `.agent/`,
  `.atl/`, `GEMINI.md`, or `scaffold/` mirrors.
- ICM obligations are explicit: task planning is stored in
  `sdd-aoi-resource-governance-TASK-2026-001`, structural workflow changes
  must persist state to `aoi-context`, and architecture decisions must be
  reflected in `aoi-architecture`.
- Tooling impact covers `rtk` rules for non-interactive commands and direct
  `icm` invocation for persistence.
- Platform impact covers `setup.sh`, `setup.ps1`, `teardown.sh`, and
  `teardown.ps1` together so `.resources/` handling stays symmetric.
- Validation strategy includes narrow checks for prompt semantics, registry
  parity, installer symmetry, and documentation drift.

## Project Structure

### Documentation (this feature)

```text
.tasks/resource-governance/TASK-2026-001/
├── proposal.md
├── requirement.md
├── spec.md
├── design.md
├── tasks.md
└── implementation-plan.md
```

### Source Code (repository root)

```text
.specify/memory/constitution.md
.resources/
├── constitution.md
├── userstories/
└── workflows/

.github/prompts/
├── sdd-new.prompt.md
├── sdd-ff.prompt.md
├── sdd-apply.prompt.md
├── sdd-verify.prompt.md
├── new-resource-folder.prompt.md
├── move-resource-folder.prompt.md
└── delete-resource-folder.prompt.md

.agent/skills/
├── sdd-new/SKILL.md
├── sdd-ff/SKILL.md
├── sdd-apply/SKILL.md
├── sdd-verify/SKILL.md
├── new-resource-folder/SKILL.md
├── move-resource-folder/SKILL.md
└── delete-resource-folder/SKILL.md

scaffold/
├── .resources/
├── .github/prompts/
├── .agent/skills/
├── .atl/skill-registry.md
└── GEMINI.md

.atl/skill-registry.md
GEMINI.md
README.md
README.es.md
setup.sh
setup.ps1
teardown.sh
teardown.ps1
```

**Structure Decision**: This feature modifies shared infrastructure surfaces and
their installed scaffold mirrors. No application `src/` tree is involved.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Additional subordinate constitution at `.resources/constitution.md` | The feature needs a local contract for allowed resource structure and folder governance. | Keeping all resource rules only in the root constitution would centralize too much detail and make folder lifecycle updates brittle. |

## Agent Assignment

- **Solution Architect**: constitutional delegation, design of workflow
  semantics, registry updates, scaffold parity, and implementation-plan
  ownership.
- **DevOps Engineer**: `setup.sh`, `setup.ps1`, `teardown.sh`, and
  `teardown.ps1` updates for `.resources/` provisioning and cleanup.
- **Documentation Analyst**: `README.md`, `README.es.md`, `GEMINI.md`, and
  `scaffold/GEMINI.md` updates once workflow semantics are stable.
- **Integration Specialist**: focused validation of prompt semantics, ICM
  persistence expectations, registry parity, and installer symmetry.

## Dependency Order

1. **Foundation Gate**: create `.resources/` contracts and amend the root
   constitution.
2. **Installer Gate**: make setup and teardown manage `.resources/`
   symmetrically.
3. **Task-Construction Gate**: update `/sdd-new` and `/sdd-ff` to keep resource
   linking explicit-only.
4. **Administrative Workflow Gate**: add `/new-resource-folder`,
   `/move-resource-folder`, and `/delete-resource-folder` with ICM persistence.
5. **Semantic Hardening Gate**: update `/sdd-apply` and `/sdd-verify` so
   `.resources/workflows/` can never be interpreted as executable commands.
6. **Documentation and Validation Gate**: reconcile docs and run focused checks.

## Verification Criteria

1. `.resources/` exists in both the live template and `scaffold/` with
   `constitution.md`, `userstories/`, and `workflows/`.
2. Task construction prompts and skills do not imply automatic `.resources/`
   loading.
3. The three administrative workflows exist in both Copilot and Antigravity and
   include explicit ICM persistence steps.
4. `.atl/skill-registry.md` and `scaffold/.atl/skill-registry.md` list the new
   workflows and the `.resources/` surface consistently.
5. `setup.sh` and `setup.ps1` provision `.resources/` symmetrically, and
   `teardown.sh` and `teardown.ps1` remove it symmetrically.
6. Prompt language across `/sdd-apply` and `/sdd-verify` makes the contextual,
   non-executable meaning of `.resources/workflows/` unambiguous.

## Execution Notes

- Implement foundation and installer work first to avoid writing workflows
  against an undefined resources contract.
- Treat every change to a root workflow or registry as incomplete until the
  `scaffold/` mirror is updated in the same slice.
- Prefer focused validation after each slice rather than large end-of-phase
  catch-up checks.