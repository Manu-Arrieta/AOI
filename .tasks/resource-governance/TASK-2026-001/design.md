# Architecture & Design: Resource Governance

**Branch**: `2026-001-resource-governance` | **Date**: 2026-05-26  
**Input**: `.tasks/resource-governance/TASK-2026-001/spec.md`

## Summary

This feature adds a governed `.resources/` subsystem to AOI without turning
it into a prerequisite for task construction. The design introduces a local
resources constitution, three administrative workflows for folder lifecycle, and
explicit prompt rules that keep `userstories/` and `workflows/` as optional
context sources rather than implicit inputs.

## Current State

- `.specify/memory/constitution.md` is the only constitution path currently
  allowed by the project governance.
- Shared workflows are mirrored across `.github/prompts/`, `.agent/skills/`,
  and `scaffold/`.
- `setup.sh` and `setup.ps1` create `.tasks/`, `.sandboxes/`, and `.atl/`, but
  do not provision `.resources/`.
- `teardown.sh` and `teardown.ps1` remove the agentic scaffold but currently do
  not treat `.resources/` as managed infrastructure.
- `/sandbox-new` is the closest pattern for a supervisor-owned workflow that
  creates managed structure and persists its state in ICM.

## Design Goals

1. Add `.resources/` as a reusable, governed subsystem separate from `.tasks/`.
2. Preserve explicit-only linkage so task construction remains fully usable
   without `.resources/`.
3. Separate resource content semantics from administrative commands.
4. Keep root and `scaffold/` surfaces semantically synchronized.
5. Make setup and teardown treat `.resources/` as managed infrastructure.
6. Persist resource structure changes in ICM using workspace-scoped context.

## Resource Model

The installed structure becomes:

```text
.resources/
├── constitution.md
├── userstories/
└── workflows/
```

The repository itself must also carry the same structure under `scaffold/` so
that new workspaces receive the default resources tree during installation:

```text
scaffold/.resources/
├── constitution.md
├── userstories/
└── workflows/
```

### Semantics

- `userstories/` stores reusable task-construction artifacts.
- `workflows/` stores component interaction definitions within a single user
  story or across multiple user stories.
- Neither directory is executable. Their contents are always contextual inputs.
- `.resources/constitution.md` governs only the `.resources/` subtree.

## Governance Model

### Root Authority

`.specify/memory/constitution.md` remains the top-level authority for the
project. It must be amended to allow one explicit subordinate contract:
`.resources/constitution.md`.

### Subordinate Resources Constitution

`.resources/constitution.md` defines:

- default folders that must exist (`userstories/`, `workflows/`)
- permitted structural mutations inside `.resources/`
- protected-folder rules for defaults
- the semantic boundary between resource content and administrative commands
- the ICM persistence expectation for create, move, and delete operations

This subordinate constitution is valid only because the root constitution
delegates to it explicitly.

## Workflow Model

### Task Construction Flows

Existing task workflows keep their current responsibility boundaries:

- `/sdd-new` and `/sdd-ff` MUST NOT auto-ingest `.resources/`
- resources are considered only when the Owner explicitly links paths from
  `.resources/`
- linked files are treated as read-only context, not as source-of-truth
  replacements for `proposal.md`, `requirement.md`, or `spec.md`

### Administrative Resource Flows

Three new workflows govern structure changes:

- `/new-resource-folder`
- `/move-resource-folder`
- `/delete-resource-folder`

Each workflow must exist in both:

- `.github/prompts/{name}.prompt.md`
- `.agent/skills/{name}/SKILL.md`

Each workflow must:

1. validate the requested structural operation against `.resources/constitution.md`
2. mutate the relevant folder structure
3. update `.resources/constitution.md` to reflect the new state
4. persist the resulting structure to ICM using workspace-scoped context
5. keep root and `scaffold/` surfaces aligned when the installed default
   structure changes

## Sync Surfaces

This feature touches shared infrastructure, so dual-sync is mandatory across the
live repository and `scaffold/`.

### Repository Surfaces

- `.specify/memory/constitution.md`
- `.resources/constitution.md`
- `.github/prompts/sdd-new.prompt.md`
- `.github/prompts/sdd-ff.prompt.md`
- `.github/prompts/sdd-apply.prompt.md`
- `.github/prompts/sdd-verify.prompt.md`
- `.github/prompts/new-resource-folder.prompt.md`
- `.github/prompts/move-resource-folder.prompt.md`
- `.github/prompts/delete-resource-folder.prompt.md`
- `.agent/skills/sdd-new/SKILL.md`
- `.agent/skills/sdd-ff/SKILL.md`
- `.agent/skills/sdd-apply/SKILL.md`
- `.agent/skills/sdd-verify/SKILL.md`
- `.agent/skills/new-resource-folder/SKILL.md`
- `.agent/skills/move-resource-folder/SKILL.md`
- `.agent/skills/delete-resource-folder/SKILL.md`
- `.atl/skill-registry.md`
- `GEMINI.md`
- `README.md`
- `README.es.md`
- `setup.sh`
- `setup.ps1`
- `teardown.sh`
- `teardown.ps1`

### Scaffold Mirrors

- `scaffold/.resources/constitution.md`
- `scaffold/.github/prompts/...`
- `scaffold/.agent/skills/...`
- `scaffold/.atl/skill-registry.md`
- `scaffold/GEMINI.md`

## Setup and Teardown Strategy

### Setup

`setup.sh` and `setup.ps1` already merge `scaffold/` and then create required
directories that may be skipped when empty. This feature extends that logic so
the installers also ensure:

- `.resources/`
- `.resources/userstories/`
- `.resources/workflows/`

If `scaffold/.resources/constitution.md` is copied as expected, setup only needs
to ensure the directories exist. If empty directories are skipped, setup must
recreate them after merge.

### Teardown

`teardown.sh` and `teardown.ps1` must remove `.resources/` as part of managed
agentic infrastructure removal, while preserving the current behavior of not
destroying unrelated project source files.

## ICM Model

Resource operations should use existing workspace-scoped memory channels rather
than introducing unscoped topics.

- structural state changes: store in `{WORKSPACE}-context` with resource-related
  keywords
- feature-specific planning and design: store in
  `sdd-{WORKSPACE}-resource-governance-TASK-2026-001`
- architecture knowledge: add or refine memoir concepts under
  `{WORKSPACE}-architecture`

This keeps resource state recoverable while remaining consistent with the
project's ICM naming rules.

## Validation Strategy

Focused validation should cover the narrowest executable or mechanically
checkable surfaces available for this repo:

- prompt and skill files validate without unresolved placeholders
- root and `scaffold/` workflow registries stay in sync
- setup and teardown scripts remain symmetric in the directories they manage
- administrative workflow files include explicit ICM persistence steps
- task-construction flows continue to work without implicit `.resources/`
  loading
- `.resources/workflows/` is described consistently as context, not execution

## Risks and Mitigations

- **Governance conflict**: the current constitution rejects alternate
  constitution paths. Mitigation: amend root governance first and treat
  `.resources/constitution.md` as a single explicit exception.
- **Semantic confusion**: `workflows/` may be mistaken for executable
  automation. Mitigation: reinforce the distinction in constitutions, prompts,
  skills, and docs.
- **Dual-sync drift**: new workflow surfaces can diverge between root and
  `scaffold/`. Mitigation: tasks pair every root change with its mirror.
- **Installer asymmetry**: setup may create `.resources/` while teardown leaves
  it behind. Mitigation: update both shell and PowerShell teardown paths in the
  same implementation slice.

## Structure Decision

This feature is implemented as shared infrastructure, not as application code.
The authoritative change surface is the combination of constitutions, workflow
prompts and skills, registries, scaffold mirrors, and installer scripts. No
`src/` or `tests/` tree is introduced for this feature.
