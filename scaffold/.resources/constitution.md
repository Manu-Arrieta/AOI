# Resources Constitution

## Authority

- This document governs only the `.resources/` subtree.
- It is subordinate to `.specify/memory/constitution.md`, which remains the
  top-level authority for the project.

## Required Structure

The managed default structure is:

```text
.resources/
├── constitution.md
├── userstories/
└── workflows/
```

- `userstories/` stores reusable task-construction context.
- `workflows/` stores component interaction definitions within one user story
  or across multiple user stories.

## Semantics

- Content under `.resources/` is contextual input only.
- Files inside `workflows/` are never executable commands, shell macros, or
  workflow automations.
- Task-construction flows may use resources only when the Owner explicitly
  links them.

## Mutation Rules

- Structural changes inside `.resources/` must go through the dedicated
  administrative workflows.
- Any structural mutation must update this file and persist the resulting state
  in workspace-scoped ICM context.
- Default folders remain part of the managed baseline unless an updated
  governing workflow and the root constitution explicitly allow otherwise.
