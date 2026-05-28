# Feature Specification: Dashboard UX & Bilingual Enhancement

**Feature Branch**: `2026-003-agentic-ops-dashboard`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Make the existing dashboard much more attractive and intuitive, and allow switching the UI between English and Spanish in both directions."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clearer Operational Experience (Priority: P1)

As the Owner, I want the existing dashboard to feel more intentional, legible,
and intuitive, so that I can scan the operational state quickly without losing
clarity around current work, task detail, or governed actions.

**Why this priority**: The current dashboard already works functionally, so the
main value of this iteration is to improve comprehension, visual hierarchy, and
ease of use during daily operations.

**Independent Test**: This story is independently testable by opening the
dashboard, scanning tasks, detail, artifacts, relations, and resource areas,
and confirming that operational priorities and action zones are easier to
understand without removing any existing capability.

**Acceptance Scenarios**:

1. **Given** an active dashboard session, **When** the Owner views the main
   workspace shell, **Then** the layout makes overview metrics, current focus,
   and available actions easier to distinguish.
2. **Given** a selected task, **When** the Owner inspects its detail panel,
   **Then** task status, artifact context, and explicit relations remain easy to
   understand within the refreshed visual hierarchy.

---

### User Story 2 - Explicit Bilingual UI Shell (Priority: P1)

As the Owner, I want to switch the dashboard interface between English and
Spanish, so that I can operate the dashboard in the language that is most
useful to me at the moment.

**Why this priority**: The dashboard is now an active internal workspace
surface; language choice directly affects readability, adoption, and daily
operational comfort.

**Independent Test**: This story is independently testable by switching the UI
language, confirming that structural interface text changes immediately, and
reloading the page to verify that the chosen language persists.

**Acceptance Scenarios**:

1. **Given** the dashboard is open, **When** the Owner changes the language from
   English to Spanish or from Spanish to English, **Then** the user-facing UI
   shell text updates immediately without forcing a separate configuration flow.
2. **Given** the Owner previously selected a language, **When** the dashboard is
   reloaded or reopened, **Then** the same language remains active.

---

### User Story 3 - Safe Localized Operations (Priority: P2)

As the Owner, I want governed resource actions and realtime status feedback to
remain clear after the UX and language changes, so that presentation improvements
never make operational behavior less safe or less understandable.

**Why this priority**: This iteration must improve usability without weakening
the clarity of destructive or governed actions that already exist in the
dashboard.

**Independent Test**: This story is independently testable by opening governed
resource actions and observing realtime updates while switching language,
confirming that the dashboard remains understandable and safe.

**Acceptance Scenarios**:

1. **Given** the Owner initiates a governed resource action, **When** the action
   dialog is shown, **Then** warnings, prompts, and calls to action are clear in
   the selected language.
2. **Given** the dashboard receives realtime operational updates, **When** the
   Owner changes language or remains focused on the current view, **Then** the
   interface continues to surface changes without losing context.

---

### Edge Cases

- What happens when a translation entry is missing for one language?
- How does the dashboard behave when Spanish text is substantially longer than
  the equivalent English label?
- What happens when the saved language preference is unavailable, corrupt, or
  missing?
- How does the dashboard behave when the Owner switches language while a task is
  selected or a governed action dialog is open?
- How are raw artifact contents, task identifiers, and repository-origin values
  handled when the surrounding shell language changes?

## Constitution Alignment *(mandatory)*

### Existing Surface Discovery

- Existing services, prompts, and runtime surfaces affected:
  `apps/agentic-ops-dashboard/app/pages/index.vue`,
  `apps/agentic-ops-dashboard/app/components/**`,
  `apps/agentic-ops-dashboard/app/assets/styles/main.css`,
  `apps/agentic-ops-dashboard/app/composables/**`, UI-focused tests under
  `apps/agentic-ops-dashboard/test/ui/**`, and matching `scaffold/` mirrors.
- Copilot, Antigravity, and `scaffold/` sync impact: because this is an
  installed dashboard runtime, all live application changes must remain mirrored
  under `scaffold/apps/agentic-ops-dashboard/**`.
- Tooling and platform impact: this iteration stays inside the existing managed
  dashboard runtime and must preserve current realtime behavior, governed action
  boundaries, and cross-platform installation parity.
- Required follow-up updates: dashboard UI shell, locale or copy surfaces,
  focused UI validation, and any runtime documentation that describes the
  dashboard experience.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST preserve the existing dashboard's ability to show
  task, artifact, relation, and governed resource information while improving
  the presentation experience.
- **FR-002**: The dashboard MUST provide an explicit, visible language switch
  between English and Spanish.
- **FR-003**: The currently selected language MUST persist across page reloads
  and subsequent returns to the dashboard.
- **FR-004**: Structural UI text, labels, empty states, warnings, prompts,
  buttons, and operational shell copy MUST render in the selected language.
- **FR-005**: Raw artifact content, task identifiers, and other repository
  source content MUST remain in their original form rather than being translated
  heuristically by the dashboard.
- **FR-006**: The refreshed dashboard experience MUST improve visual hierarchy,
  scannability, and clarity of the existing operational surfaces.
- **FR-007**: Realtime operational feedback MUST remain understandable and
  context-preserving after the UX and language enhancements.
- **FR-008**: Governed resource actions MUST continue to communicate safety,
  confirmation, and risk clearly in the currently selected language.
- **FR-009**: The dashboard MUST update its language without requiring a
  separate configuration route or a manual full reload as the normal interaction
  path.
- **FR-010**: The experience MUST degrade safely when a translation is missing
  or a stored language preference is invalid.
- **FR-011**: The feature MUST preserve the existing task and resource sources
  of truth and MUST NOT introduce language-specific divergence in operational
  data.
- **FR-012**: The dashboard contract MUST remain compatible with future
  presentation enhancements without reopening the stabilized backend and
  governance behavior of the current runtime.

### Key Entities *(include if feature involves data)*

- **Locale Preference**: The selected interface language for the current Owner.
- **UI Dictionary**: The structured set of user-facing dashboard shell strings
  available in English and Spanish.
- **Operational Shell Copy**: The user-facing presentation text around
  navigation, panels, statuses, warnings, prompts, and actions.
- **Translated Status Presentation**: The display-friendly representation of
  operational labels in the active UI language without mutating the source data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Owner can switch between English and Spanish directly from the
  dashboard and observe immediate UI shell translation.
- **SC-002**: Reloading or reopening the dashboard restores the Owner's last
  selected language.
- **SC-003**: The dashboard presents a more legible and intuitive visual
  hierarchy while preserving the visibility of tasks, artifacts, relations, and
  governed resource surfaces.
- **SC-004**: Raw artifact contents and repository-origin values remain
  unaffected by language changes.
- **SC-005**: Governed action prompts and warnings remain clear and safe in both
  supported languages.
- **SC-006**: Longer translated strings, especially in Spanish, do not break the
  usability of the dashboard on the supported viewport range.

## Assumptions

- Only English and Spanish are in scope for this iteration.
- The translation scope is limited to the dashboard's structural UI shell and
  operational presentation, not to arbitrary workspace content.
- The Owner's language preference can be stored locally without requiring a new
  server-side preference service.
- Existing realtime, task detail, relation, and governed resource behaviors are
  stable and should be preserved rather than redesigned functionally.