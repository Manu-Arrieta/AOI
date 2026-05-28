# Implementation Plan: Dashboard UX & Language Switching

**Branch**: `2026-003-agentic-ops-dashboard` | **Date**: 2026-05-26 | **Spec**: `.tasks/agentic-ops-dashboard/TASK-2026-003/spec.md`  
**Input**: Feature specification from `.tasks/agentic-ops-dashboard/TASK-2026-003/spec.md`

## Summary

This plan advances TASK-2026-003 as a focused enhancement of the existing
dashboard runtime. The implementation adds a lightweight client-side locale
layer for English and Spanish, translates the dashboard shell without changing
repository-source content, refreshes the visual hierarchy of the current UI, and
keeps all existing realtime and governed `.resources/` behavior intact.

## Technical Context

**Language/Version**: TypeScript, Vue 3, Nuxt 4.4.6, CSS, Vitest  
**Primary Dependencies**: `nuxt`, `vue`  
**Storage**: local client preference storage for the selected locale; repository
files remain the operational source of truth  
**Testing**: focused UI tests for locale switching, persistence, translated shell
rendering, layout resilience, and non-regression of governed resource behavior  
**Target Platform**: local internal dashboard runtime in the workspace on
desktop-class browsers  
**Project Type**: existing internal application enhancement plus mirrored
scaffold updates  
**Performance Goals**: immediate UI language changes, preserved realtime
responsiveness, and no added server-side latency or payload branching by locale  
**Constraints**: backend and governance behavior stay stable, translation is
presentation-only, live and `scaffold/` parity is mandatory, and the enhancement
must tolerate longer Spanish strings without degrading usability  
**Scale/Scope**: dashboard shell, locale utilities, key components, styles,
focused UI tests, and runtime documentation

## Constitution Check

*GATE: Must pass before implementation begins. Re-check after design is applied.*

- Dual-sync scope is explicit for all changed runtime files in both the live
  repository and `scaffold/`.
- ICM obligations remain explicit under
  `sdd-aoi-agentic-ops-dashboard-TASK-2026-003`, including progress,
  decisions, and final validation outcomes.
- No `.resources/` links were provided for this task, so no relation-record
  updates are planned.
- Tooling impact stays inside the current dashboard runtime and focused UI test
  surfaces; setup and teardown behavior should remain unchanged unless a later
  implementation detail proves otherwise.
- Validation strategy includes locale persistence, translated shell coverage,
  responsive resilience, governed action clarity, and live versus `scaffold/`
  parity.

## Project Structure

### Documentation (this feature)

```text
.tasks/agentic-ops-dashboard/TASK-2026-003/
├── proposal.md
├── requirement.md
├── spec.md
├── design.md
├── tasks.md
└── implementation-plan.md
```

### Source Code (repository root)

```text
apps/
└── agentic-ops-dashboard/
    ├── app.vue
    ├── app/
    │   ├── assets/styles/main.css
    │   ├── components/
    │   ├── composables/
    │   ├── pages/
    │   └── utils/
    └── test/
        └── ui/

scaffold/
└── apps/
    └── agentic-ops-dashboard/
        └── ... mirrored runtime surfaces ...

README.md
README.es.md
```

**Structure Decision**: The enhancement stays inside the existing dashboard app
instead of introducing a second runtime or a larger i18n framework. Locale state,
copy dictionaries, and visual refresh all live close to the presentation layer.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Introducing a dedicated locale layer | Bilingual UI shell behavior must be centralized and persistent. | Per-component ad hoc conditionals would drift quickly and make copy maintenance expensive. |
| Mapping translated presentation labels over language-neutral data | The dashboard must speak the selected language without forking the source data. | Translating repository-origin values directly would blur source-of-truth semantics. |
| Refreshing the shared visual system instead of isolated one-off tweaks | The request explicitly targets overall attractiveness and intuitiveness, not a few label swaps. | Small local tweaks would leave hierarchy and readability inconsistent across the shell. |

## Agent Assignment

- **Solution Architect**: planning ownership, dependency order, parity scope, and
  implementation-plan authorship.
- **Frontend Developer**: locale foundation, shell redesign, bilingual component
  coverage, style refresh, and UI behavior.
- **Integration Specialist**: focused validation for locale persistence,
  translated shell rendering, and non-regression of governed action clarity.
- **Documentation Analyst**: README updates for the refreshed bilingual dashboard
  experience, if documentation changes are required.

## Dependency Order

1. **Locale Foundation Gate**: add the UI dictionary, locale composable, and
   persistence behavior.
2. **Shell Refresh Gate**: update the main shell and page hierarchy to surface
   the language toggle and stronger scan order.
3. **Primary Surface Gate**: refresh task inventory and detail views.
4. **Secondary Surface Gate**: apply bilingual shell behavior to relations and
   governed resource surfaces.
5. **Safety & Non-Regression Gate**: validate governed action clarity and
   realtime comprehension after the redesign.
6. **Documentation & Parity Gate**: reconcile docs and verify live versus
   `scaffold/` parity across all changed files.

## Verification Criteria

1. The Owner can switch between EN and ES directly from the dashboard shell.
2. Reloading the dashboard restores the last selected language.
3. The dashboard's structural UI text updates immediately without a separate
   configuration flow.
4. Raw artifact content and repository-origin values remain untranslated.
5. Task, relation, and resource surfaces remain understandable after the visual
   refresh and do not regress functionally.
6. Governed action prompts remain clear and visually safe in both languages.
7. Changed live runtime files remain in sync with `scaffold/` mirrors.

## Execution Notes

- Keep translation scope tightly limited to the UI shell and operational
  presentation layer.
- Prefer one centralized dictionary over repeated local string branches.
- Treat longer Spanish copy as a layout input from the start rather than as a
  late polish problem.
- Use existing UI tests as non-regression anchors while adding locale-focused
  coverage for the new slice.