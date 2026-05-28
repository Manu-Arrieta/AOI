# Tasks: Agentic Operations Dashboard

**Input**: Design documents from `.tasks/agentic-ops-dashboard/TASK-2026-002/`  
**Prerequisites**: `implementation-plan.md`, `spec.md`, `design.md`

**Tests**: Focused validation is required for workspace parsing, realtime update
delivery, governed `.resources/` actions, root and `scaffold/` parity, and
setup or teardown symmetry.

**Organization**: Tasks are grouped by setup, foundations, user stories, and
polish so the feature can be implemented incrementally and reviewed by slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files do not overlap
- **[Story]**: `Setup`, `Foundation`, `US1`, `US2`, `US3`, or `Polish`
- Every task includes exact repository paths

## Path Conventions

- Runtime metadata lives at the repository root and under `scaffold/`
- The live dashboard app lives in `apps/agentic-ops-dashboard/`
- The installed template mirror lives in `scaffold/apps/agentic-ops-dashboard/`
- Relation metadata lives beside task artifacts at
  `.tasks/{feature}/TASK-YYYY-NNN/relations.json`
- Prompt and skill surfaces that preserve task-to-resource relations live under
  `.github/prompts/`, `.agent/skills/`, and `scaffold/` mirrors

## Constitution-Driven Task Types

- Add mirrored tasks whenever the live runtime metadata or app source changes
  under both root and `scaffold/`.
- Add workflow-guidance tasks whenever explicit relation metadata is created or
  preserved by SDD flows.
- Add setup and teardown parity tasks whenever managed runtime surfaces change.
- Add focused validation tasks for realtime semantics, path guardrails, and root
  versus scaffold drift.

## Phase 1: Setup (Workspace Runtime)

**Purpose**: Establish the managed Node workspace and the internal dashboard app
in both the live repository and `scaffold/`.

- [x] T001 [P] [Setup] Create root `package.json` and `pnpm-workspace.yaml`, and
      mirror them to `scaffold/package.json` and
      `scaffold/pnpm-workspace.yaml`, to define the managed workspace runtime.
- [x] T002 [P] [Setup] Create the baseline Nuxt application under
      `apps/agentic-ops-dashboard/` (`package.json`, `nuxt.config.ts`,
      `app.vue`, `app/`, `server/`, `shared/`, `test/`) and mirror the same
      structure under `scaffold/apps/agentic-ops-dashboard/`.
- [x] T003 [Setup] Update `setup.sh` and `setup.ps1` so scaffold installation
      provisions the dashboard workspace and installs managed dependencies when
      workspace metadata is present.
- [x] T004 [Setup] Update `teardown.sh` and `teardown.ps1` so the managed
      dashboard runtime and app-specific dependency artifacts are removed
      symmetrically without deleting unrelated project files.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the explicit relation contract and teach SDD workflows to
preserve it whenever `.resources/` files are explicitly linked.

**⚠️ CRITICAL**: No dashboard UI or server implementation should start before
the relation contract and workflow capture rules exist.

- [x] T005 [Foundation] Define the canonical relation contract in
      `apps/agentic-ops-dashboard/shared/types.ts`,
      `apps/agentic-ops-dashboard/shared/relations.ts`, and matching
      `scaffold/apps/agentic-ops-dashboard/shared/` files.
- [x] T006 [P] [Foundation] Update `.github/prompts/sdd-new.prompt.md`,
      `.agent/skills/sdd-new/SKILL.md`,
      `scaffold/.github/prompts/sdd-new.prompt.md`, and
      `scaffold/.agent/skills/sdd-new/SKILL.md` so explicit `.resources/` links
      create or update `.tasks/{feature}/TASK-YYYY-NNN/relations.json`.
- [x] T007 [P] [Foundation] Update `.github/prompts/sdd-ff.prompt.md`,
      `.agent/skills/sdd-ff/SKILL.md`,
      `scaffold/.github/prompts/sdd-ff.prompt.md`, and
      `scaffold/.agent/skills/sdd-ff/SKILL.md` so planning preserves and
      extends `.tasks/{feature}/TASK-YYYY-NNN/relations.json` only when explicit
      `.resources/` links exist.
- [x] T008 [Foundation] Run focused validation on the updated prompt and skill
      surfaces to confirm planning never auto-loads `.resources/` and only
      persists explicit resource links into `relations.json`.

**Checkpoint**: Explicit relation metadata exists as a governed contract and can
be produced by task workflows.

---

## Phase 3: User Story 1 - Real-Time Operations Visibility (Priority: P1) 🎯 MVP

**Goal**: Provide a live dashboard view of tasks, states, and artifacts.

**Independent Test**: State or artifact changes in the workspace appear in the
dashboard without manual refresh.

### Validation for User Story 1

- [x] T009 [US1] Add focused validation for registry parsing, snapshot building,
      and realtime event delivery under
      `apps/agentic-ops-dashboard/test/server/` and mirror fixtures needed under
      `scaffold/apps/agentic-ops-dashboard/test/server/`.

### Implementation for User Story 1

- [x] T010 [US1] Implement the authoritative snapshot builder in
      `apps/agentic-ops-dashboard/server/utils/build-workspace-snapshot.ts`,
      `apps/agentic-ops-dashboard/server/utils/parse-task-registry.ts`, and
      matching `scaffold/apps/agentic-ops-dashboard/server/utils/` files.
- [x] T011 [P] [US1] Implement workspace watching and SSE delivery in
      `apps/agentic-ops-dashboard/server/utils/watch-workspace.ts`,
      `apps/agentic-ops-dashboard/server/api/workspace.get.ts`,
      `apps/agentic-ops-dashboard/server/routes/events.ts`, and matching
      `scaffold/apps/agentic-ops-dashboard/server/` files.
- [x] T012 [P] [US1] Build the dashboard overview UI in
      `apps/agentic-ops-dashboard/app/pages/index.vue`,
      `apps/agentic-ops-dashboard/app/components/TaskBoard.vue`, and
      `apps/agentic-ops-dashboard/app/components/TaskSummaryCard.vue`, with the
      same files mirrored under `scaffold/apps/agentic-ops-dashboard/app/`.
- [x] T013 [P] [US1] Build task detail and artifact inspection UI in
      `apps/agentic-ops-dashboard/app/components/TaskDetailPanel.vue`,
      `apps/agentic-ops-dashboard/app/components/ArtifactList.vue`, and
      `apps/agentic-ops-dashboard/app/components/ArtifactViewer.vue`, plus
      `scaffold/` mirrors.

**Checkpoint**: The dashboard can show live task inventory and artifact detail.

---

## Phase 4: User Story 2 - Explicit Task-to-Resource Relations (Priority: P1)

**Goal**: Make explicit task-to-resource relations visible and resilient.

**Independent Test**: Tasks with valid relations render them, tasks without
relations degrade gracefully, and stale references are visible without breaking
the UI.

### Validation for User Story 2

- [x] T014 [US2] Add focused validation for relation loading and stale-reference
      handling under `apps/agentic-ops-dashboard/test/server/relations.test.ts`
      and `apps/agentic-ops-dashboard/test/ui/task-relations.test.ts`, plus any
      mirrored fixtures under `scaffold/apps/agentic-ops-dashboard/test/`.

### Implementation for User Story 2

- [x] T015 [US2] Implement relation loading in
      `apps/agentic-ops-dashboard/server/utils/load-task-relations.ts`,
      `apps/agentic-ops-dashboard/server/api/tasks/[taskId].get.ts`, and
      matching `scaffold/apps/agentic-ops-dashboard/server/` files.
- [x] T016 [P] [US2] Implement relation presentation UI in
      `apps/agentic-ops-dashboard/app/components/TaskRelationsPanel.vue` and the
      task detail composition files that consume it, with matching
      `scaffold/apps/agentic-ops-dashboard/app/` mirrors.

**Checkpoint**: Explicit user-story and workflow relations are visible and
gracefully handled.

---

## Phase 5: User Story 3 - Governed Interaction with Resources (Priority: P2)

**Goal**: Allow governed `.resources/` operations from the dashboard without
opening arbitrary write access.

**Independent Test**: Supported `.resources/` actions succeed with governance,
while attempts to mutate unsupported paths are blocked.

### Validation for User Story 3

- [x] T017 [US3] Add focused validation for allowed and forbidden write paths in
      `apps/agentic-ops-dashboard/test/server/resource-operations.test.ts` and
      `apps/agentic-ops-dashboard/test/ui/resource-explorer.test.ts`, plus
      mirrored fixtures if required under `scaffold/apps/agentic-ops-dashboard/test/`.

### Implementation for User Story 3

- [x] T018 [US3] Implement governed resource operations in
      `apps/agentic-ops-dashboard/server/utils/resource-operations.ts`,
      `apps/agentic-ops-dashboard/server/api/resources/create.post.ts`,
      `apps/agentic-ops-dashboard/server/api/resources/move.post.ts`,
      `apps/agentic-ops-dashboard/server/api/resources/delete.post.ts`, and
      matching `scaffold/apps/agentic-ops-dashboard/server/` files.
- [x] T019 [P] [US3] Implement the `.resources/` explorer and action dialogs in
      `apps/agentic-ops-dashboard/app/components/ResourceExplorer.vue`,
      `apps/agentic-ops-dashboard/app/components/ResourceActionDialog.vue`, and
      mirrored `scaffold/apps/agentic-ops-dashboard/app/components/` files.
- [x] T020 [US3] Add server-side guardrails and error mapping in the resource
      API handlers so all writes outside `.resources/` are rejected and
      governance failures are surfaced clearly to the UI.

**Checkpoint**: The dashboard can perform governed `.resources/` operations and
reject everything else.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final synchronization and validation across runtime, workflow, and
documentation surfaces.

- [x] T021 [P] [Polish] Update `README.md`, `README.es.md`, `GEMINI.md`,
      `scaffold/GEMINI.md`, `.atl/skill-registry.md`, and
      `scaffold/.atl/skill-registry.md` to document the dashboard runtime,
      `relations.json`, and the governed interaction boundary.
- [x] T022 [P] [Polish] Reconcile root and scaffold runtime commands in
      `package.json`, `apps/agentic-ops-dashboard/package.json`,
      `scaffold/package.json`, and
      `scaffold/apps/agentic-ops-dashboard/package.json` so development,
      testing, and build surfaces stay aligned.
- [x] T023 [Polish] Run focused smoke validation for `setup.sh`, `setup.ps1`,
      `teardown.sh`, `teardown.ps1`, dashboard workspace scripts, and prompt or
      skill parity after all changes land.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: can start immediately
- **Foundation (Phase 2)**: depends on Phase 1 and blocks all story work
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2 and benefits from US1 snapshot work
- **US3 (Phase 5)**: depends on Phase 2 and US1 server foundations
- **Polish (Phase 6)**: depends on all desired user stories being complete

### User Story Dependencies

- **US1**: depends only on the workspace and relation foundations
- **US2**: depends on the relation contract and the task detail UI
- **US3**: depends on the existing governed `.resources/` model and the server
  runtime introduced for US1

### Parallel Opportunities

- T001 and T002 can run in parallel
- T006 and T007 can run in parallel, followed by T008
- T011, T012, and T013 can run in parallel after T010
- T015 and T016 can run in parallel after T014 fixtures exist
- T018 and T019 can run in parallel, followed by T020
- T021 and T022 can run in parallel before T023

## Implementation Strategy

### MVP First

1. Complete setup and relation foundations
2. Deliver realtime visibility for tasks and artifacts
3. Add explicit relation rendering
4. Add governed `.resources/` interaction
5. Finish documentation and smoke validation

### Incremental Delivery

1. Workspace runtime
2. Relation capture in SDD flows
3. Read-model and event stream
4. Dashboard visibility surfaces
5. Relation panels
6. Governed resource actions
7. Cross-surface documentation and validation

## Notes

- `[P]` means file-level parallelism remains possible
- Root and `scaffold/` mirrors must be updated in the same change set for every
  managed runtime surface
- Validation is required in every phase because this feature spans both app code
  and shared infrastructure guidance