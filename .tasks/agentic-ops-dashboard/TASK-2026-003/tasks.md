# Tasks: Dashboard UX & Language Switching

**Input**: Design documents from `.tasks/agentic-ops-dashboard/TASK-2026-003/`  
**Prerequisites**: `implementation-plan.md`, `spec.md`, `design.md`

**Tests**: Focused validation is required for locale persistence, translated UI
shell rendering, responsive layout resilience, and non-regression of realtime
and governed resource behavior.

**Organization**: Tasks are grouped by foundations, user stories, and polish so
the enhancement can land incrementally on top of the existing dashboard runtime.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files do not overlap
- **[Story]**: `Foundation`, `US1`, `US2`, `US3`, or `Polish`
- Every task includes exact repository paths

## Path Conventions

- The live dashboard app lives in `apps/agentic-ops-dashboard/`
- The installed template mirror lives in `scaffold/apps/agentic-ops-dashboard/`
- Locale and presentation helpers live under `app/composables/` and `app/utils/`
- Shared visual styling remains centralized in `app/assets/styles/main.css`
- Focused UI validation lives under `test/ui/`

## Constitution-Driven Task Types

- Add mirrored tasks whenever the live dashboard runtime changes under both the
  live repository and `scaffold/`.
- Keep backend and governance behavior stable; this slice is presentation-led.
- Add focused validation tasks for locale switching, persistence, visual safety,
  and changed-surface parity.

## Phase 1: Foundations (Blocking Prerequisites)

**Purpose**: Establish the locale and translation foundation before refreshing
the visible dashboard shell.

- [x] T001 [Foundation] Create the bilingual UI dictionary and presentation
      helpers in `apps/agentic-ops-dashboard/app/utils/locales.ts` and any
      adjacent locale utility files, with matching `scaffold/apps/` mirrors.
- [x] T002 [Foundation] Create the locale-state composable in
      `apps/agentic-ops-dashboard/app/composables/useLocale.ts` and mirror it
      under `scaffold/apps/agentic-ops-dashboard/app/composables/` so the active
      language can be switched and persisted locally.
- [x] T003 [Foundation] Add focused validation for locale switching,
      persistence, and fallback behavior in
      `apps/agentic-ops-dashboard/test/ui/use-locale.test.ts`, plus mirrored
      fixtures or helpers under `scaffold/apps/agentic-ops-dashboard/test/ui/`
      if required.

**Checkpoint**: The dashboard has a centralized EN/ES locale foundation and a
validated way to persist the active language.

---

## Phase 2: User Story 1 - Clearer Operational Experience (Priority: P1)

**Goal**: Refresh the main dashboard shell and primary read surfaces to feel
more attractive, intentional, and easier to scan.

**Independent Test**: The Owner can open the dashboard and understand current
state, task focus, and available action zones more quickly than in the prior
layout without losing any existing visibility.

### Validation for User Story 1

- [x] T004 [US1] Add focused UI validation for the refreshed shell structure and
      key translated labels in `apps/agentic-ops-dashboard/test/ui/`, with
      matching scaffold test surfaces where needed.

### Implementation for User Story 1

- [x] T005 [US1] Refresh the top-level shell in
      `apps/agentic-ops-dashboard/app.vue` and
      `apps/agentic-ops-dashboard/app/pages/index.vue`, plus matching
      `scaffold/apps/agentic-ops-dashboard/` files, to introduce a visible
      language switch and stronger dashboard hierarchy.
- [x] T006 [P] [US1] Refresh task inventory surfaces in
      `apps/agentic-ops-dashboard/app/components/TaskBoard.vue` and
      `apps/agentic-ops-dashboard/app/components/TaskSummaryCard.vue`, plus
      `scaffold/` mirrors, so translated labels and the new visual rhythm apply
      consistently.
- [x] T007 [P] [US1] Refresh task detail and artifact surfaces in
      `apps/agentic-ops-dashboard/app/components/TaskDetailPanel.vue`,
      `ArtifactList.vue`, and `ArtifactViewer.vue`, plus matching `scaffold/`
      files, so shell copy, status presentation, and longer translated text stay
      legible.
- [x] T008 [US1] Update
      `apps/agentic-ops-dashboard/app/assets/styles/main.css` and
      `scaffold/apps/agentic-ops-dashboard/app/assets/styles/main.css` to carry
      the new visual hierarchy, spacing system, and responsive resilience.

**Checkpoint**: The dashboard shell, task inventory, and task detail experience
reflect the new visual direction while preserving current behavior.

---

## Phase 3: User Story 2 - Explicit Bilingual UI Shell (Priority: P1)

**Goal**: Apply the locale model across the user-facing shell of the existing
dashboard.

**Independent Test**: The Owner can switch between English and Spanish and see
the active dashboard shell update immediately while preserving current context.

### Validation for User Story 2

- [x] T009 [US2] Extend focused validation for translated shell copy,
      persisted locale selection, and raw artifact-content exemption under
      `apps/agentic-ops-dashboard/test/ui/` and mirrored scaffold test surfaces
      when required.

### Implementation for User Story 2

- [x] T010 [US2] Integrate translated copy into
      `apps/agentic-ops-dashboard/app/components/TaskRelationsPanel.vue`,
      `ResourceExplorer.vue`, and `ResourceActionDialog.vue`, plus matching
      `scaffold/` mirrors, so secondary operational surfaces respect the active
      language.
- [x] T011 [P] [US2] Add translated presentation mapping for user-facing status,
      feedback, and summary labels in the relevant locale utility and shell
      composition files under `apps/agentic-ops-dashboard/app/`, plus `scaffold/`
      mirrors, while keeping runtime payloads language-neutral.

**Checkpoint**: All major dashboard shell surfaces render coherently in EN/ES
without mutating repository-origin content.

---

## Phase 4: User Story 3 - Safe Localized Operations (Priority: P2)

**Goal**: Ensure governed action clarity and realtime comprehension remain safe
after the redesign and language enhancements.

**Independent Test**: The Owner can open governed action dialogs, inspect
warnings, and observe realtime feedback in either supported language without
losing operational clarity.

### Validation for User Story 3

- [x] T012 [US3] Extend non-regression validation for governed `.resources/`
      actions and related UI feedback in
      `apps/agentic-ops-dashboard/test/ui/resource-explorer.test.ts` and any new
      locale-aware UI tests, with mirrored scaffold surfaces when needed.

### Implementation for User Story 3

- [x] T013 [US3] Refine the governed action emphasis and translated safety copy
      in `apps/agentic-ops-dashboard/app/components/ResourceActionDialog.vue`,
      `ResourceExplorer.vue`, and page-level feedback surfaces, with matching
      `scaffold/` mirrors.

**Checkpoint**: The bilingual refresh preserves safety and legibility for the
dashboard's governed operational surfaces.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final synchronization and validation across runtime and
documentation surfaces.

- [x] T014 [P] [Polish] Update `README.md`, `README.es.md`, and any dashboard
      runtime guidance that describes the internal dashboard experience so the
      bilingual capability and refreshed UX expectations are documented.
- [x] T015 [Polish] Run focused smoke validation for locale switching,
      persistence, affected dashboard UI tests, and changed-surface parity
      between live and `scaffold/` runtime files.

## Dependencies & Execution Order

### Phase Dependencies

- **Foundation (Phase 1)**: starts immediately and blocks the shell refresh
- **US1 (Phase 2)**: depends on locale foundations
- **US2 (Phase 3)**: depends on locale foundations and benefits from the shell
  refresh work in US1
- **US3 (Phase 4)**: depends on locale foundations and the translated governed
  surfaces introduced earlier
- **Polish (Phase 5)**: depends on all desired stories being complete

### User Story Dependencies

- **US1**: depends on the locale state and dictionary foundation
- **US2**: depends on the locale foundation and the refreshed shell surfaces
- **US3**: depends on existing governed resource behavior plus translated dialog
  and feedback surfaces

### Parallel Opportunities

- T001 and T002 can run in close sequence, followed by T003
- T006 and T007 can run in parallel after T005 starts the shell refresh
- T010 and T011 can run in parallel after T009 defines the validation target
- T014 can run in parallel with late UI completion before T015

## Implementation Strategy

### MVP First

1. Establish locale dictionaries and persisted language state
2. Refresh the shell and primary task surfaces
3. Extend bilingual coverage across relations and governed action surfaces
4. Validate non-regression and parity
5. Finish docs and smoke checks

### Incremental Delivery

1. Locale foundation
2. Shell refresh and hierarchy improvements
3. Full bilingual UI shell coverage
4. Governed action clarity refinements
5. Documentation and validation