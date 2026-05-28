# Architecture & Design: Agentic Operations Dashboard

**Branch**: `2026-002-agentic-ops-dashboard` | **Date**: 2026-05-26  
**Input**: `.tasks/agentic-ops-dashboard/TASK-2026-002/spec.md`

## Summary

This feature adds an internal real-time operations dashboard to the agentic
infrastructure as a local Nuxt 4 full-stack application. The design introduces
an authoritative workspace read-model over `.tasks/` and `.resources/`, a
canonical `relations.json` sidecar for explicit task-to-resource links, a
watcher-driven update pipeline using Nitro plus SSE, and a governed write
boundary that allows dashboard mutations only inside `.resources/`. Because the
dashboard is part of the infrastructure itself, the runtime, app source,
documentation, and setup behavior must remain synchronized between the live
repository and `scaffold/`.

## Current State

- The repository currently has no web application runtime, root `package.json`,
  or `pnpm-workspace.yaml`.
- Task state lives in `.tasks/registry.md` and task-local artifact directories.
- `.resources/` already exists as a governed optional subtree, with dedicated
  create, move, and delete workflows.
- No canonical machine-readable relation model currently links tasks to
  `.resources/`; the only available signal is free-text user input, which is not
  reliable enough for UI rendering.
- Setup and teardown scripts currently manage agentic infrastructure surfaces
  but do not know about a Node-based internal application runtime.

## Design Goals

1. Introduce a single local runtime that keeps UI, server-side filesystem access,
   and realtime delivery inside one managed application.
2. Preserve `.tasks/` and `.resources/` as authoritative sources of truth,
   rather than migrating state into a database.
3. Formalize task-to-resource relations through an explicit sidecar contract.
4. Keep dashboard write capabilities narrowly constrained to governed
   `.resources/` operations.
5. Maintain root and `scaffold/` parity for all installed runtime and guidance
   surfaces.
6. Keep the initial implementation small enough to deliver visibility first,
   while leaving room for richer interactions later.

## Runtime Model

### Technology Direction

- **Framework**: Nuxt 4.4.6 as the single internal application runtime.
- **Package Workspace**: `pnpm` workspace metadata at the repository root and
  mirrored under `scaffold/`.
- **Server Runtime**: Nitro server routes for snapshot reads, governed write
  actions, and realtime streaming.
- **Realtime Transport**: SSE for the first iteration, because the current
  requirement is server-to-client state propagation rather than peer-to-peer or
  chat-style bidirectional messaging.
- **Filesystem Reactivity**: `chokidar` watchers owned by the server runtime to
  observe `.tasks/registry.md`, `.tasks/**`, and `.resources/**`.

### Directory Topology

The live repository gains a managed application surface:

```text
package.json
pnpm-workspace.yaml
apps/
└── agentic-ops-dashboard/
    ├── package.json
    ├── nuxt.config.ts
    ├── app.vue
    ├── app/
    │   ├── pages/
    │   └── components/
    ├── server/
    │   ├── api/
    │   ├── routes/
    │   └── utils/
    ├── shared/
    └── test/
```

Because the dashboard is part of the infrastructure, equivalent runtime metadata
and application files must be mirrored under:

```text
scaffold/package.json
scaffold/pnpm-workspace.yaml
scaffold/apps/agentic-ops-dashboard/
```

## Authoritative Read-Model

The dashboard does not create its own persisted store. It materializes a live
snapshot from authoritative repository surfaces:

- `.tasks/registry.md` for task inventory and lifecycle state.
- `.tasks/{feature}/TASK-YYYY-NNN/*.md` for per-task artifacts.
- `.tasks/{feature}/TASK-YYYY-NNN/relations.json` for explicit links to
  reusable resources.
- `.resources/**` for governed reusable context tree exploration.

The server-side snapshot builder normalizes these into one response shape for
the UI. Malformed or missing records degrade gracefully and are surfaced as
status conditions rather than crashing the dashboard.

## Relation Capture Model

To satisfy the requirement that task-to-resource relations be explicit and
reliable, each task may include a canonical sidecar:

```text
.tasks/{feature}/TASK-YYYY-NNN/relations.json
```

Initial schema:

```json
{
  "userstories": [".resources/userstories/example.md"],
  "workflows": [".resources/workflows/example.md"]
}
```

### Ownership Rules

- The relation record belongs to the task directory it describes.
- The dashboard reads relation records but does not author them in the first
  iteration.
- `/sdd-new` and `/sdd-ff` must be updated so that when the Owner explicitly
  links files under `.resources/`, those links are preserved into
  `relations.json` instead of being lost in prose-only context.
- Missing relation files are valid; stale paths are rendered as unresolved
  references, not silently repaired.

## Realtime Model

The Nitro runtime exposes:

- a snapshot endpoint for initial load and reconnect recovery
- an SSE route for change notifications

`chokidar` watchers listen for changes in the authoritative task and resource
surfaces. On relevant changes, the server rebuilds or refreshes the affected
portion of the snapshot and emits a small update event. On reconnect or watcher
desynchronization, the client performs a full resync through the snapshot
endpoint.

This keeps the first iteration simple while still satisfying the realtime
requirement.

## Governed Write Model

The dashboard's initial write scope is limited to `.resources/`.

### Supported Writes

- create governed folder inside `.resources/`
- move governed folder inside `.resources/`
- delete governed folder inside `.resources/`

### Boundaries

- No write path is exposed for task artifacts under `.tasks/`.
- Any path outside `.resources/` is rejected by the server.
- The server-side implementation must apply the same governance expectations as
  the existing resource-administration workflows: path validation, constitution
  alignment, and ICM persistence.

The preferred implementation is a shared resource-operations service used by the
dashboard API handlers so that governance logic is centralized rather than
duplicated inconsistently.

## UI Model

The first-cut UI includes five surfaces:

- workspace overview
- task board or list for active and archived work
- task detail panel with artifact inspector
- relations panel showing linked user stories and workflows when present
- `.resources/` explorer with governed folder actions

The UI is intentionally read-heavy. The only interactive mutations are the
governed `.resources/` operations.

## Sync Surfaces

This feature touches both application code and shared infrastructure guidance.

### Live Repository

- `package.json`
- `pnpm-workspace.yaml`
- `apps/agentic-ops-dashboard/**`
- `.github/prompts/sdd-new.prompt.md`
- `.github/prompts/sdd-ff.prompt.md`
- `.agent/skills/sdd-new/SKILL.md`
- `.agent/skills/sdd-ff/SKILL.md`
- `README.md`
- `README.es.md`
- `GEMINI.md`
- `.atl/skill-registry.md`
- `setup.sh`
- `setup.ps1`
- `teardown.sh`
- `teardown.ps1`

### Scaffold Mirrors

- `scaffold/package.json`
- `scaffold/pnpm-workspace.yaml`
- `scaffold/apps/agentic-ops-dashboard/**`
- `scaffold/.github/prompts/sdd-new.prompt.md`
- `scaffold/.github/prompts/sdd-ff.prompt.md`
- `scaffold/.agent/skills/sdd-new/SKILL.md`
- `scaffold/.agent/skills/sdd-ff/SKILL.md`
- `scaffold/GEMINI.md`
- `scaffold/.atl/skill-registry.md`

## Setup and Teardown Strategy

### Setup

`setup.sh` and `setup.ps1` must:

- copy the scaffolded dashboard runtime into the target workspace
- ensure `apps/agentic-ops-dashboard/` exists after scaffold merge
- provision workspace package metadata when present
- install managed dashboard dependencies in a cross-platform-safe way

### Teardown

`teardown.sh` and `teardown.ps1` must:

- remove the managed dashboard runtime from the workspace
- clean up managed dependency artifacts introduced solely for the dashboard
- avoid deleting unrelated user source files outside the managed surfaces

## Validation Strategy

Focused validation must cover the narrowest executable or mechanically checkable
surfaces available:

- root and scaffold workspace metadata stay in sync
- `/sdd-new` and `/sdd-ff` persist `relations.json` only when explicit
  `.resources/` links exist
- snapshot parsing handles missing or malformed relation files gracefully
- realtime updates reach the UI without manual refresh
- paths outside `.resources/` are rejected by governed write endpoints
- setup and teardown remain symmetric across shell and PowerShell variants

## Risks and Mitigations

- **Relation drift**: task-to-resource links can become stale when files move.
  Mitigation: unresolved references are shown explicitly and never inferred.
- **Format fragility**: Markdown registries can drift. Mitigation: centralize
  parsing in one server-side read-model layer and test malformed inputs.
- **Runtime sprawl**: adding a Node workspace expands the infrastructure.
  Mitigation: keep one internal app root and mirror it exactly under
  `scaffold/`.
- **Governance duplication**: UI actions could diverge from CLI workflows.
  Mitigation: share resource-operation validation logic and preserve ICM writes.

## Structure Decision

This feature is implemented as both an internal application and an adjacent
infrastructure update. The app is new application code, but relation capture,
setup, teardown, documentation, and scaffold parity are equally authoritative
parts of the delivery surface.