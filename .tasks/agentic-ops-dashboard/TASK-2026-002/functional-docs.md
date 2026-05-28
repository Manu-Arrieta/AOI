# Agentic Ops Dashboard

## Overview

This task introduced the foundational internal dashboard runtime for `aoi`.
The dashboard provides a live operational view over the authoritative
workspace surfaces, lets the Owner inspect task artifacts and explicit
task-to-resource relations, and allows a narrow set of governed actions inside
`.resources/`.

This document captures the functional contract closed by TASK-2026-002. Later
presentation and bilingual-shell refinements are documented separately in
`TASK-2026-003`.

## What Was Implemented

- A managed Nuxt 4 internal application under `apps/agentic-ops-dashboard/`.
- A live workspace snapshot built from `.tasks/registry.md`, task artifact
  directories, and `.resources/`.
- Realtime refresh through filesystem watching plus SSE updates.
- A task board that shows current and archived work from the authoritative
  registry.
- A task detail flow for artifact inspection.
- Explicit task-to-resource relation rendering through task-local
  `relations.json` sidecars.
- A governed `.resources/` explorer with supported create, move, and delete
  actions.
- Root and `scaffold/` parity for runtime metadata, app code, setup, teardown,
  prompts, skills, and documentation.

## How To Use The Dashboard

### Observe the workspace state

- Open the dashboard to load the current workspace snapshot.
- The board groups tasks by lifecycle state using the authoritative task
  registry.
- Active and archived tasks remain visible without manually traversing the
  repository.
- When relevant files change, the dashboard refreshes from the server-side
  workspace model instead of relying on a manual browser reload.

### Inspect a task

- Select a task from the board to open its detail panel.
- Review its feature membership, lifecycle state, owner, and timeline metadata.
- Inspect the known artifacts discovered in the task directory.
- Open artifact content through the dashboard's read-only viewer.

### Interpret explicit relations

- If a task has `.tasks/{feature}/TASK-YYYY-NNN/relations.json`, linked user
  stories and workflows are shown in the relations panel.
- If a task has no relation sidecar, the task remains fully usable and no
  relation is inferred from prose.
- If a stored relation points to a missing resource, the dashboard surfaces the
  stale reference without crashing the rest of the UI.

### Use governed resource actions

- Browse the `.resources/` subtree through the resource explorer.
- Supported actions are limited to governed create, move, and delete
  operations inside `.resources/`.
- The dashboard rejects unsupported paths and refuses writes outside the
  governed subtree.

## Read-Only And Governed Boundaries

The dashboard is intentionally read-heavy.

- Task artifacts under `.tasks/` stay read-only from the UI.
- The dashboard does not expose arbitrary repository writes.
- Task-to-resource relations are read from explicit metadata only.
- `.resources/workflows/` is treated as repository context, not as an
  executable control plane.

## Realtime Behavior

- The first load comes from the snapshot endpoint.
- Realtime updates are delivered through SSE after filesystem changes are
  detected on authoritative task and resource surfaces.
- If the realtime stream disconnects or watcher state is uncertain, the client
  can recover through a full snapshot reload.

## Notable Edge Cases

- Malformed registry or task-local metadata degrades gracefully rather than
  taking down the dashboard.
- Missing `relations.json` files are valid and simply render as no explicit
  relations.
- Stale relation paths are surfaced as unresolved references.
- Large or unsupported artifact formats may remain limited-preview or
  read-only surfaces.
- Concurrent CLI and dashboard actions still resolve through the same
  authoritative repository files.

## Summary

TASK-2026-002 established the dashboard as the authoritative live workspace
window for `aoi`: realtime task visibility, artifact inspection, explicit
relation rendering, and governed `.resources/` interaction, all without
introducing a parallel persisted store.