# Tasks: Resource Governance

**Input**: Design documents from `.tasks/resource-governance/TASK-2026-001/`  
**Prerequisites**: `implementation-plan.md`, `spec.md`, `design.md`

**Tests**: Focused validation tasks are required because this feature changes
shared workflow surfaces, setup/teardown behavior, constitutions, and mirrored
registry content.

**Organization**: Tasks are grouped by user story so each slice remains
independently reviewable and implementable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files do not overlap
- **[Story]**: `Setup`, `Foundation`, `US1`, `US2`, `US3`, or `Polish`
- Every task includes exact repository paths

## Path Conventions

- Shared workflow prompts live in `.github/prompts/`
- Antigravity mirrors live in `.agent/skills/`
- Installed template mirrors live under `scaffold/`
- Governing constitutions live in `.specify/memory/constitution.md` and
  `.resources/constitution.md`

## Constitution-Driven Task Types

- Add mirrored tasks whenever `.github/`, `.agent/`, `.atl/`, `GEMINI.md`, or
  `scaffold/` surfaces change.
- Add setup/teardown parity tasks whenever the installed structure changes.
- Add focused validation tasks for prompt semantics, ICM persistence, and
  registry or documentation drift.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the new managed resources structure in the live template
and the installed scaffold.

- [x] T001 [P] [Setup] Create `.resources/constitution.md` and
      `scaffold/.resources/constitution.md` with default-folder rules for
      `userstories/` and `workflows/` and explicit non-executable semantics for
      resource content.
- [x] T002 [P] [Setup] Ensure `.resources/userstories/` and
      `.resources/workflows/` exist in both the live repository and under
      `scaffold/.resources/`.
- [x] T003 [P] [Setup] Update `setup.sh` and `setup.ps1` so post-scaffold setup
      guarantees `.resources/`, `.resources/userstories/`, and
      `.resources/workflows/` exist even when empty directories are skipped by
      scaffold copy operations.
- [x] T004 [P] [Setup] Update `teardown.sh` and `teardown.ps1` so `.resources/`
      is removed together with other AOI-managed infrastructure.
- [x] T005 [P] [Setup] Update `README.md`, `README.es.md`, `GEMINI.md`, and
      `scaffold/GEMINI.md` to document `.resources/` as an installed, optional
      context subsystem.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish governance and registry baselines that all user stories
depend on.

**⚠️ CRITICAL**: No user story work should start before this phase is complete.

- [x] T006 [Foundation] Amend `.specify/memory/constitution.md` to explicitly
      recognize `.resources/constitution.md` as a subordinate contract while
      preserving root constitutional authority.
- [x] T007 [P] [Foundation] Update `.atl/skill-registry.md` and
      `scaffold/.atl/skill-registry.md` to add the `.resources/` surface and the
      new resource-administration workflows.
- [x] T008 [Foundation] Reconcile any governance wording in `GEMINI.md` and
      `scaffold/GEMINI.md` so resource workflows and the subordinate
      constitution do not conflict with the root constitution rules.

**Checkpoint**: Governance and scaffold baseline are ready for story work.

---

## Phase 3: User Story 1 - Opt-In Reusable User Stories (Priority: P1) 🎯 MVP

**Goal**: Allow explicit resource linkage during task construction without any
default ingestion of `.resources/`.

**Independent Test**: Task construction proceeds normally without linked
resources, and linked `.resources/userstories/*` files are only used when the
Owner explicitly references them.

### Validation for User Story 1

- [x] T009 [US1] Run focused validation on the task-construction surfaces to
      confirm no prompt or skill implies automatic `.resources/` ingestion.

### Implementation for User Story 1

- [x] T010 [P] [US1] Update `.github/prompts/sdd-new.prompt.md` and
      `.agent/skills/sdd-new/SKILL.md` so resource paths are treated as explicit
      opt-in context only.
- [x] T011 [P] [US1] Update `.github/prompts/sdd-ff.prompt.md` and
      `.agent/skills/sdd-ff/SKILL.md` so planning never auto-loads `.resources/`
      and only consumes explicitly linked files.
- [x] T012 [P] [US1] Mirror T010 and T011 into
      `scaffold/.github/prompts/sdd-new.prompt.md`,
      `scaffold/.github/prompts/sdd-ff.prompt.md`,
      `scaffold/.agent/skills/sdd-new/SKILL.md`, and
      `scaffold/.agent/skills/sdd-ff/SKILL.md`.
- [x] T013 [US1] Refine `.resources/constitution.md` and
      `scaffold/.resources/constitution.md` to document explicit-only linkage for
      task construction and the role of `userstories/` as reusable context.

**Checkpoint**: Tasks can be created without `.resources/`, and linked
`userstories/` files remain optional context.

---

## Phase 4: User Story 2 - Governed Administrative Workflows (Priority: P1)

**Goal**: Add explicit workflows for creating, moving, and deleting resource
folders while keeping constitutions, registries, and ICM synchronized.

**Independent Test**: Each administrative workflow has mirrored Copilot and
Antigravity definitions, includes explicit ICM persistence, and updates the
resources constitution consistently.

### Validation for User Story 2

- [x] T014 [US2] Run focused validation on workflow parity, ICM command
      presence, and registry entries for the three resource-administration
      commands.

### Implementation for User Story 2

- [x] T015 [P] [US2] Create `.github/prompts/new-resource-folder.prompt.md` and
      `.agent/skills/new-resource-folder/SKILL.md` for governed folder creation
      inside `.resources/`.
- [x] T016 [P] [US2] Create `.github/prompts/move-resource-folder.prompt.md` and
      `.agent/skills/move-resource-folder/SKILL.md` for governed folder moves
      inside `.resources/`.
- [x] T017 [P] [US2] Create `.github/prompts/delete-resource-folder.prompt.md`
      and `.agent/skills/delete-resource-folder/SKILL.md` for governed folder
      deletion inside `.resources/`.
- [x] T018 [P] [US2] Mirror T015, T016, and T017 into `scaffold/.github/prompts/`
      and `scaffold/.agent/skills/`.
- [x] T019 [US2] Update `.atl/skill-registry.md`, `scaffold/.atl/skill-registry.md`,
      `GEMINI.md`, and `scaffold/GEMINI.md` so the three administrative commands
      are discoverable and documented as non-SDD support workflows.
- [x] T020 [US2] Encode workspace-scoped ICM persistence rules for resource
      structure changes inside all three workflow definitions and align them with
      `.resources/constitution.md`.

**Checkpoint**: Resource folder lifecycle is fully governed by dedicated,
mirrored workflows.

---

## Phase 5: User Story 3 - Component Interaction Definitions (Priority: P2)

**Goal**: Keep `.resources/workflows/` semantically constrained to interaction
definitions and prevent any execution-oriented interpretation.

**Independent Test**: A linked file from `.resources/workflows/` is consumed as
functional guidance and never treated as a terminal instruction.

### Validation for User Story 3

- [x] T021 [US3] Run focused validation on implementation and verification
      workflow language to ensure `.resources/workflows/*` cannot be interpreted
      as executable commands.

### Implementation for User Story 3

- [x] T022 [P] [US3] Update `.github/prompts/sdd-apply.prompt.md` and
      `.agent/skills/sdd-apply/SKILL.md` to classify `.resources/workflows/*` as
      read-only interaction definitions.
- [x] T023 [P] [US3] Update `.github/prompts/sdd-verify.prompt.md` and
      `.agent/skills/sdd-verify/SKILL.md` so verification treats linked workflow
      resources as contextual artifacts, not runnable instructions.
- [x] T024 [P] [US3] Mirror T022 and T023 into `scaffold/.github/prompts/` and
      `scaffold/.agent/skills/`.
- [x] T025 [US3] Refine `.resources/constitution.md` and
      `scaffold/.resources/constitution.md` to codify the semantic difference
      between `workflows/` resources and the administrative commands that manage
      folders.

**Checkpoint**: Workflow resources are clearly contextual across planning,
implementation, and verification.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final synchronization and validation across all shared surfaces.

- [x] T026 [P] [Polish] Reconcile `README.md`, `README.es.md`, `GEMINI.md`,
      `scaffold/GEMINI.md`, `.atl/skill-registry.md`, and
      `scaffold/.atl/skill-registry.md` so terminology for `.resources/`,
      `userstories/`, `workflows/`, and the new commands is consistent.
- [x] T027 [P] [Polish] Run repository-scoped validation for the changed
      Markdown artifacts, prompt files, and registry files using the narrowest
      available checks.
- [x] T028 [Polish] Run focused smoke checks for `setup.sh`, `setup.ps1`,
      `teardown.sh`, and `teardown.ps1` to confirm `.resources/` is handled
      symmetrically.

## Completion

All planned tasks were completed on `2026-05-26`. The feature is ready for
verification.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: can start immediately
- **Foundational (Phase 2)**: depends on Phase 1 and blocks all story work
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2
- **US3 (Phase 5)**: depends on Phase 2 and benefits from US1 wording updates
- **Polish (Phase 6)**: depends on all desired user stories being complete

### User Story Dependencies

- **US1**: no dependency on US2 or US3 once governance baseline exists
- **US2**: no dependency on US1 implementation, but shares terminology with US1
- **US3**: depends on the resources semantics defined in Phase 1 and refined in
  US1 and US2

### Parallel Opportunities

- T001, T002, T003, T004, and T005 can run in parallel if staffed separately
- T007 and T008 can run in parallel after T006
- T010 and T011 can run in parallel, followed by T012
- T015, T016, and T017 can run in parallel, followed by T018-T020
- T022 and T023 can run in parallel, followed by T024-T025

## Implementation Strategy

### MVP First

1. Complete Setup + Foundational phases
2. Deliver US1 so task construction remains safe and optional with respect to
   `.resources/`
3. Deliver US2 to govern folder lifecycle
4. Validate both before broadening to US3 semantics

### Incremental Delivery

1. Foundation first
2. Optional resource-linking behavior
3. Administrative workflows
4. Workflow-resource semantic hardening
5. Final documentation and smoke validation

## Notes

- `[P]` means different files with no direct dependency
- Shared infrastructure changes must always be paired with `scaffold/` mirrors
- Validation is required for every phase because the feature changes prompts,
  registries, constitutions, and installers
