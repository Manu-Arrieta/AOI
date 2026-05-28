# Implementation Plan: Agentic Operations Dashboard

**Branch**: `2026-002-agentic-ops-dashboard` | **Date**: 2026-05-26 | **Spec**: `.tasks/agentic-ops-dashboard/TASK-2026-002/spec.md`  
**Input**: Feature specification from `.tasks/agentic-ops-dashboard/TASK-2026-002/spec.md`

## Summary

This plan introduces a locally hosted Nuxt 4 dashboard as a managed part of the
agentic infrastructure. The implementation adds root and scaffold workspace
metadata, a live app under `apps/agentic-ops-dashboard/`, a server-side
filesystem read-model and SSE update pipeline, a canonical `relations.json`
sidecar for explicit task-to-resource mapping, and governed `.resources/`
interaction through server APIs that preserve constitution and ICM rules.

## Technical Context

**Language/Version**: TypeScript, Vue 3, Nuxt 4.4.6, Nitro, Markdown, Bash,
PowerShell 7+  
**Primary Dependencies**: `nuxt`, `vue`, `chokidar`, root `pnpm` workspace
metadata  
**Storage**: repository files remain the source of truth; the dashboard builds a
server-side snapshot from `.tasks/` and `.resources/`  
**Testing**: focused parser tests, realtime route smoke checks, UI component
tests, prompt or skill semantic validation, setup and teardown smoke checks  
**Target Platform**: local VS Code workspaces on macOS, Linux, and Windows 11+  
**Project Type**: internal application plus shared infrastructure updates  
**Performance Goals**: near-real-time visibility without manual refresh,
graceful fallback when watch events fail, and bounded parsing cost over the
current workspace surfaces  
**Constraints**: `.tasks/` stays read-only from the dashboard, writes are
limited to governed `.resources/` operations, root and scaffold parity is
mandatory, explicit relation records replace heuristic inference, setup and
teardown must remain symmetric  
**Scale/Scope**: repository root workspace metadata, app code, scaffold mirrors,
SDD prompt/skill relation capture, docs, and lifecycle scripts

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design is applied.*

- Dual-sync scope is explicit for every managed runtime surface in both the live
  repository and `scaffold/`.
- ICM obligations are explicit: task planning stays under
  `sdd-aoi-agentic-ops-dashboard-TASK-2026-002`, governed resource writes
  must persist through existing workspace-scoped channels, and architecture
  concepts must be reflected in `aoi-architecture`.
- Tooling impact covers `rtk` rules for shell commands, direct `icm` usage for
  persistence, and managed package workspace setup through repository scripts.
- Platform impact covers `setup.sh`, `setup.ps1`, `teardown.sh`, and
  `teardown.ps1` together so the dashboard runtime stays symmetric across host
  environments.
- Validation strategy includes relation-record semantics, realtime update
  behavior, root vs scaffold parity, and guarded write enforcement.

## Project Structure

### Documentation (this feature)

```text
.tasks/agentic-ops-dashboard/TASK-2026-002/
├── proposal.md
├── requirement.md
├── spec.md
├── design.md
├── tasks.md
└── implementation-plan.md
```

### Source Code (repository root)

```text
package.json
pnpm-workspace.yaml

apps/
└── agentic-ops-dashboard/
    ├── package.json
    ├── nuxt.config.ts
    ├── app.vue
    ├── app/
    ├── server/
    ├── shared/
    └── test/

scaffold/
├── package.json
├── pnpm-workspace.yaml
└── apps/
    └── agentic-ops-dashboard/

.github/prompts/
├── sdd-new.prompt.md
└── sdd-ff.prompt.md

.agent/skills/
├── sdd-new/SKILL.md
└── sdd-ff/SKILL.md

README.md
README.es.md
GEMINI.md
.atl/skill-registry.md
setup.sh
setup.ps1
teardown.sh
teardown.ps1
```

**Structure Decision**: The feature is implemented as an internal application
plus adjacent workflow and documentation changes. Task artifacts remain the
authoritative data source; the dashboard only projects and governs them.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Introducing root Node workspace metadata and an `apps/` tree | Nuxt requires a managed runtime surface and the dashboard must be part of the installed infrastructure. | Keeping the dashboard outside the infrastructure would fail the requirement that it ship as part of the agentic project. |
| Introducing `relations.json` alongside task artifacts | Explicit relation visibility requires a canonical machine-readable contract. | Heuristic parsing of prompts or markdown prose is not reliable enough for a dashboard contract. |
| Adding an SSE plus watcher pipeline | Near-real-time visibility is a core product requirement. | Polling alone would be simpler but would not satisfy the expected realtime behavior cleanly. |

## Agent Assignment

- **Solution Architect**: relation contract, workspace structure, dependency
  ordering, root/scaffold parity, and implementation-plan ownership.
- **DevOps Engineer**: root and scaffold package workspace metadata, setup and
  teardown script changes, and managed runtime lifecycle handling.
- **Backend Developer**: snapshot builder, relation loader, watcher pipeline,
  SSE route, and governed `.resources/` API handlers.
- **Frontend Developer**: dashboard overview, task detail, relation panel,
  resource explorer, and UI state composition.
- **Documentation Analyst**: `README.md`, `README.es.md`, `GEMINI.md`, and
  registry guidance updates once runtime behavior is stable.
- **Integration Specialist**: focused validation for prompt semantics, parser
  resilience, guarded writes, parity, and runtime smoke checks.

## Dependency Order

1. **Workspace Runtime Gate**: create root and scaffold workspace metadata and
   the managed dashboard app skeleton.
2. **Relation Capture Gate**: update `/sdd-new` and `/sdd-ff` so explicit
   `.resources/` links are preserved in `relations.json`.
3. **Read-Model Gate**: implement registry parsing, task artifact indexing,
   relation loading, and snapshot assembly.
4. **Realtime Gate**: add watchers and SSE delivery so the app receives changes
   without manual refresh.
5. **Visibility UI Gate**: build overview, task detail, artifact inspection,
   and relation panels.
6. **Governed Action Gate**: add `.resources/` explorer and server-side guarded
   operations.
7. **Documentation & Validation Gate**: reconcile docs, registries, and smoke
   checks once the runtime is stable.

## Verification Criteria

1. `setup.sh` and `setup.ps1` provision the managed dashboard runtime and
   dependencies symmetrically with `scaffold/` metadata.
2. `teardown.sh` and `teardown.ps1` remove the managed runtime symmetrically
   without deleting unrelated user files.
3. `/sdd-new` and `/sdd-ff` preserve `relations.json` only when explicit
   `.resources/` links are present.
4. The dashboard reads `.tasks/registry.md`, task artifacts, and `.resources/`
   into a valid snapshot and degrades gracefully on malformed or missing
   relation records.
5. The dashboard reflects task or artifact changes without manual refresh.
6. Supported writes succeed only inside `.resources/`, and unsupported paths are
   rejected.
7. Root and `scaffold/` runtime files, docs, and workflow guidance remain in
   sync.

## Execution Notes

- Implement relation capture before UI relation rendering so the first
  end-to-end slice has authoritative data to consume.
- Keep governed write logic centralized server-side rather than duplicating path
  validation across multiple handlers.
- Treat root/scaffold drift as a release blocker because the dashboard is part
  of the installed infrastructure, not a repo-only convenience.