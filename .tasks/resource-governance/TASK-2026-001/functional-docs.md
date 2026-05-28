# Functional Documentation — Resource Governance

## Summary

AOI now includes an optional `.resources/` subsystem. It gives repository
owners a governed place to store reusable context, such as user stories and
component interaction definitions, without turning that context into a mandatory
dependency for normal SDD task construction.

## What Was Added

- A root-level `.resources/` directory managed by AOI.
- A default `.resources/userstories/` folder for reusable task-construction
  context.
- A default `.resources/workflows/` folder for interaction definitions between
  components.
- A local `.resources/constitution.md` contract that governs only the resources
  subtree under the bounded authority of `.specify/memory/constitution.md`.
- Three administrative commands to create, move, and delete governed folders
  inside `.resources/`.

## How To Use It

`.resources/` is inert by default.

1. Keep reusable user-story context in `.resources/userstories/`.
2. Keep cross-component interaction definitions in `.resources/workflows/`.
3. During `/sdd-new` or `/sdd-ff`, explicitly link only the files you want the
   Owner workflow to consider.
4. If no resource is linked, task construction continues normally.

This means Owners can work in two modes:

- direct task construction with no resource linkage
- enriched task construction using explicitly linked files from `.resources/`

## Administrative Commands

### `/new-resource-folder`

Use this command when you need to create a new governed folder inside
`.resources/`.

Typical use:

- add a new reusable context category
- extend the subtree while keeping constitution and ICM synchronized

### `/move-resource-folder`

Use this command when an existing resource folder must be renamed or relocated
inside `.resources/`.

Typical use:

- rename a category to better reflect its purpose
- reorganize the resource subtree without losing governance tracking

### `/delete-resource-folder`

Use this command when a governed folder inside `.resources/` is obsolete and
should be removed.

Typical use:

- retire an unused resource category
- remove a folder while keeping constitution and ICM aligned with the new state

## Rules And Edge Cases

- `.resources/` is opt-in only. No SDD workflow should auto-read it.
- `.resources/workflows/` is never executable automation. Its contents are
  always contextual definitions, never shell commands, scripts, or macros.
- The root constitution still wins. If `.resources/constitution.md` conflicts
  with `.specify/memory/constitution.md`, the root constitution prevails.
- Default folders such as `userstories/` and `workflows/` remain governed by
  the local resources constitution and should not be moved or deleted unless
  that contract explicitly allows it.
- If a linked resource path does not exist, the workflow should fail clearly
  rather than silently guessing or falling back.
- Manual structural edits outside the administrative commands are treated as
  governance drift.

## What Was Intentionally Excluded

- No automatic ingestion of `.resources/` during `/sdd-new` or `/sdd-ff`.
- No change to the role of `.tasks/` as the formal store for task-local SDD
  artifacts.
- No use of `.resources/workflows/` for executable system workflows,
  operational scripts, or automation pipelines.
- No single catch-all command for create, move, and delete. Those operations
  remain separate by design.

## Operational Notes

- `setup.sh` and `setup.ps1` provision `.resources/`, `userstories/`, and
  `workflows/`.
- `teardown.sh` and `teardown.ps1` remove `.resources/` together with the rest
  of the managed AOI infrastructure.
- Root and `scaffold/` mirrors stay synchronized so new workspaces inherit the
  same governed resource structure and workflow definitions.
- Administrative resource commands persist structural changes to workspace-
  scoped ICM context.