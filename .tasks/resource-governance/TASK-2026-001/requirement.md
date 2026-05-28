# Functional Requirements: Resource Governance (TASK-2026-001)

## Summary

Introduce a governed `.resources/` subsystem to the agentic infrastructure,
serving as a repository for reusable knowledge such as user stories and workflow
component interactions. Ensure this subsystem remains fully opt-in during
standard task construction, and manage its structural lifecycle through
dedicated administrative workflows that preserve context in ICM and uphold the
project's root constitution.

## Problem

Currently, there is no standardized, governed location to persist reusable
internal resources such as repeating user stories or complex component
interaction definitions across different tasks. Mixing these with task-specific
artifacts degrades clarity, and placing them in unmanaged folders causes
structural drift, breaking the governance model enforced by the project's root
constitution.

## Goals

- Establish a `.resources/` directory dedicated to reusable internal project
  knowledge.
- Provide a default structure comprising `userstories/` and `workflows/`.
- Ensure standard task construction operations do not strictly require the
  `.resources/` folder.
- Implement explicit administrative workflows (`/new-resource-folder`,
  `/move-resource-folder`, `/delete-resource-folder`) to govern directory
  lifecycle.
- Maintain `.specify/memory/constitution.md` as the supreme project authority,
  formally delegating rules for the resources subtree to a
  `.resources/constitution.md` file.
- Keep the project resource structure and state fully tracked in ICM.

## Non-Goals

- Modifying or restricting the existing `.tasks/` isolated, ephemeral
  structure.
- Forcing the automatic ingestion of `.resources/` into every `/sdd-new` or SDD
  workflow. Task generation must remain functional without consuming resources.
- Using `workflows/` as a directory for administrative system commands or
  executable automation scripts. It is strictly for defining component
  interactions within or across user stories.

## User Stories

1. **As the Owner**, I want to store reusable user stories in
   `.resources/userstories/`, so that I can explicitly link them when requesting
   the construction of a new task without repeating myself.
2. **As the Owner**, I want to define multi-component interaction sequences in
   `.resources/workflows/`, so that I can reference these interactions
   consistently across various tasks.
3. **As the Owner**, I want to selectively link resources only when necessary
   during task construction, so that I maintain autonomy and speed when creating
   simple tasks that do not depend on historical resources.
4. **As the Supervisor/Agent**, I need explicit administrative workflows to
   create, move, or delete resource folders, so that I can dynamically maintain
   `.resources/constitution.md` and keep ICM strictly synchronized with the
   workspace.

## Functional Requirements

- **Resource Repository Creation**: The system must support a `.resources/`
  directory at the project root containing by default `userstories/` and
  `workflows/`.
- **Top-level Governance Delegation**: The root constitution
  (`.specify/memory/constitution.md`) must be amended to explicitly delegate
  authority over the `.resources/` subdirectory to
  `.resources/constitution.md`.
- **Resource Constitution**: The `.resources/constitution.md` file must dictate
  the allowed structure and rules strictly within the `.resources/` boundary.
- **Opt-in Linkage**: The processes surrounding task construction must allow,
  but not require, the explicit linking of files from `.resources/`. The
  absence of links must not block or degrade standard task scaffolding.
- **Administrative Lifecycle Workflows**:
  - The system must provide three distinct, dedicated user-facing workflows for
    folder lifecycle: `/new-resource-folder`, `/move-resource-folder`, and
    `/delete-resource-folder`.
  - These workflows must dynamically update `.resources/constitution.md` to
    reflect structural changes.
- **ICM Integration**: All administrative operations on the `.resources/`
  structure must trigger context storage or updates in ICM to track the state of
  the project's internal resources.

## Constraints

- Task construction such as `/sdd-new` and `/sdd-ff` must remain completely
  decoupled from `.resources/` by default.
- The root constitution (`.specify/memory/constitution.md`) cannot be replaced
  or bypassed by the resource constitution; it must remain the ultimate source
  of truth.
- The folder `workflows/` inside `.resources/` is restricted semantically to
  document component interactions relevant to the domain, not agentic shell
  commands or system macros.
- All structural updates to the infrastructure must adhere to the Dual-Sync
  protocol across Copilot and Antigravity.

## Acceptance Signals

- A task can be successfully created and planned without the agent touching
  `.resources/`.
- A task can successfully ingest a user story from `.resources/userstories/`
  when explicitly told to do so by the owner.
- Executing `/new-resource-folder`, `/move-resource-folder`, or
  `/delete-resource-folder` correctly updates the folder tree, modifies
  `.resources/constitution.md`, and persists changes cleanly to ICM.

## Risks/Dependencies

- **Governance Clash**: Risk of the local `.resources/constitution.md`
  conflicting with the primary root constitution if the delegation clause is
  ambiguous.
- **Agent Confusion**: Risk of AI models misinterpreting the `workflows/`
  directory as executable scripts rather than functional interaction
  definitions, requiring precise prompts and skill updates.
- **Synchronization**: Setup scripts, agent registries (`.atl/skill-registry.md`),
  and the `scaffold/` mirror must all be updated symmetrically to avoid
  ecosystem drift.