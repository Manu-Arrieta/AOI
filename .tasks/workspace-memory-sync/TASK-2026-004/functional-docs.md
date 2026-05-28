# Workspace Memory Sync And Rollback

## Overview

This update adds a governed way to bring memory context from another workspace
into the current workspace without replacing the active memory state blindly.
Instead of writing directly into the live memory surface, the workflow creates a
candidate memory version, records the Owner's intent and merge decisions, and
only activates that version after explicit approval. If the new active memory is
later considered incorrect, degraded, or unsafe, the workspace can roll back to
the previous registered version.

This first iteration is workflow-first. It does not add a dashboard screen for
memory sync yet. The feature is operated through the governed task workflows and
the managed version store under `.specify/memory/versions/`.

## What Was Implemented

- A managed version store for workspace memory under
  `.specify/memory/versions/`.
- A canonical active-memory pointer in `active.json`.
- Immutable memory version manifests that record source workspace, source
  version, selected scopes, Owner context, and merge decisions.
- Dynamic constitution snapshots tied to each candidate or active memory
  version.
- A governed `/sync-workspace-memory` workflow for preparing and optionally
  activating a new version.
- A governed `/rollback-workspace-memory` workflow for restoring the previously
  active version.
- Deterministic validation and lifecycle scripts for resolution, candidate
  preparation, activation, and rollback.

## How To Use Memory Sync

### Prepare a sync candidate

- Run `/sync-workspace-memory`.
- Provide the source workspace.
- Provide the exact source memory version.
- Choose which scopes to include: `memories`, `memoir`, `feedback`, or all.
- Provide the Owner context that explains why the sync is needed and what it
  should prioritize.
- Define what should be retained, complemented, and discarded.

The workflow prepares a candidate version rather than replacing the active
memory immediately.

### Review before activation

Before activation, the workflow presents:

- the source workspace and source version
- the new target version ID
- the selected scopes
- the Owner context
- the `retain` / `complement` / `discard` plan
- the current active version and the immediate rollback target

If you do not approve activation, the candidate remains prepared but inactive.

### Activate a new version

If you approve the candidate:

- the candidate becomes the active memory version
- `active.json` is updated
- the previous active manifest is marked as superseded
- the previous active version remains the immediate rollback target

## How To Use Rollback

### Restore the previous version

- Run `/rollback-workspace-memory`.
- Provide the target version to restore.
- Provide the reason for the rollback.
- Confirm that the current active version should be replaced.

The rollback restores the registered previous version and marks the reverted
version as `rolled-back`.

## What Gets Recorded

Each governed memory sync or rollback records:

- the active pointer in `.specify/memory/versions/active.json`
- a version manifest under `.specify/memory/versions/manifests/{workspace}/`
- a dynamic constitution snapshot under
  `.specify/memory/versions/constitutions/{workspace}/`
- ICM entries describing the candidate, activation, verification, and archive
  state

## Guardrails

- A sync cannot proceed without an explicit source workspace and source version.
- A candidate cannot be activated without explicit Owner approval.
- Unsupported scopes are rejected.
- A version ID cannot be reused if a manifest already exists.
- Rollback only restores the registered previous version in this first
  iteration.
- Missing manifests or missing constitution snapshots cause resolution to fail
  fast.

## Notable Edge Cases

- If the active pointer references a missing manifest, the resolver stops with a
  validation error.
- If a manifest references a missing dynamic constitution snapshot, the version
  cannot be resolved as active.
- If no previous version is registered, rollback is refused.
- If the Owner wants a broader rollback strategy than the immediate previous
  version, that requires a future governed expansion of the workflow.
- This release does not provide a dedicated UI for browsing or activating memory
  versions; operation is still prompt-driven.

## Summary

Workspace memory sync is now versioned, reviewable, and reversible. The current
workspace can prepare a governed candidate from another workspace's memory,
activate it explicitly, and restore the previous version when needed, all while
keeping a clear audit trail of source, intent, merge decisions, and rollback
state.