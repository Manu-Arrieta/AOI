# Architecture & Design: Dashboard UX & Language Switching

**Branch**: `2026-003-agentic-ops-dashboard` | **Date**: 2026-05-26  
**Input**: `.tasks/agentic-ops-dashboard/TASK-2026-003/spec.md`

## Summary

This iteration evolves the existing `agentic-ops-dashboard` runtime rather than
creating a new one. The design adds a lightweight client-side locale layer for
English and Spanish, centralizes UI shell copy into translation dictionaries,
introduces presentation mapping for user-facing operational labels, and refreshes
the visual hierarchy of the current dashboard surfaces. The design preserves the
existing realtime, task-detail, relation, and governed `.resources/` behavior by
keeping all server contracts and source-of-truth data language-neutral.

## Current State

- The internal dashboard runtime already exists and is implemented under
  `apps/agentic-ops-dashboard/` with mirrored `scaffold/` surfaces.
- `app/pages/index.vue`, `app/components/**`, and `app/assets/styles/main.css`
  currently define the visual shell and most of the visible UI copy.
- Realtime updates, task detail loading, explicit relation rendering, and
  governed `.resources/` actions are already implemented and validated.
- The dashboard currently exposes hardcoded English UI shell text across the
  main page, panels, dialogs, feedback states, and action labels.
- No locale state, no persistent language preference, and no shared translation
  catalog exist today.

## Design Goals

1. Improve hierarchy, readability, and intentional visual rhythm across the
   existing dashboard shell.
2. Add an explicit EN/ES language switcher with immediate application and
   persisted preference.
3. Centralize UI shell strings so bilingual support remains maintainable as the
   dashboard grows.
4. Preserve existing realtime behavior, selected-task context, relation
   visibility, and governed action safety.
5. Maintain root and `scaffold/` parity for every changed runtime surface.
6. Keep the iteration small and frontend-focused, without reopening stabilized
   backend, data-model, or governance contracts.

## Runtime Preservation Model

This slice does not change the dashboard's runtime topology.

- Existing task, relation, and resource endpoints remain unchanged.
- Existing SSE behavior remains unchanged.
- Existing resource-operation guardrails remain unchanged.
- Existing repository files remain the authoritative source of truth.

The implementation boundary is therefore the presentation layer of the existing
runtime, plus any small client-side utilities needed to support locale state and
copy centralization.

## Locale Model

### Language Scope

- Supported locales: `en` and `es`
- Scope: UI shell only
- Exclusions: raw artifact bodies, task IDs, file paths, registry-source labels,
  and other repository-native values remain unmodified as source data

### Client-Side Preference

The dashboard introduces a small locale state layer inside the client runtime.

- A dedicated locale composable owns the active language and exposes switching
  behavior.
- The selected language is persisted locally so reloads and later returns reopen
  the dashboard in the same language.
- Invalid or missing stored values fall back safely to the default locale.

### Dictionary Structure

All repeated UI shell strings move into a centralized bilingual dictionary.

- panel headings
- hero copy and summary copy
- button labels
- dialog titles and descriptions
- empty states and fallback text
- warnings, confirmations, and action hints
- translated presentation labels for statuses or summary chips

This prevents translation drift and avoids scattering bilingual conditionals
through every component.

## Presentation Mapping Model

The dashboard continues to consume language-neutral operational data from the
existing runtime, but it may map that data into translated presentation labels.

- task lifecycle states can be rendered using translated display labels
- governed action prompts can use translated explanatory text
- relation buckets and resource labels can use translated shell terms

This mapping exists only in presentation. The underlying source values remain
unchanged so the dashboard never forks domain data by locale.

## Visual Refresh Model

### Shell Refresh

The top-level dashboard shell gains a more deliberate information hierarchy.

- the overview shell surfaces current state and controls more clearly
- the language switch remains visible from the main experience
- active focus, supporting context, and governed action areas become easier to
  distinguish at a glance

### Component Refresh

The current dashboard surfaces are refreshed in place:

- task inventory
- task summary cards
- task detail panel
- artifact list and artifact viewer
- relations panel
- resource explorer
- governed action dialog

The redesign must preserve functional coverage while improving scan order,
spacing, contrast, and visual emphasis.

### Layout Resilience

Because Spanish strings are often longer than English, the refreshed layout must
be tolerant of expansion.

- translated labels should wrap without collapsing hierarchy
- controls should remain usable on supported desktop and narrow widths
- destructive or governed actions should not lose emphasis when copy expands

## State Preservation Model

The locale enhancement must coexist with the current UI state model.

- switching language does not reset the selected task
- switching language does not discard the current snapshot
- switching language does not interrupt the current governed action flow
- realtime updates remain visible in the active language without reloading the
  application shell

## Sync Surfaces

This iteration changes application code and mirrored runtime surfaces.

### Live Repository

- `apps/agentic-ops-dashboard/app.vue`
- `apps/agentic-ops-dashboard/app/pages/index.vue`
- `apps/agentic-ops-dashboard/app/components/**`
- `apps/agentic-ops-dashboard/app/assets/styles/main.css`
- `apps/agentic-ops-dashboard/app/composables/**`
- `apps/agentic-ops-dashboard/app/utils/**`
- `apps/agentic-ops-dashboard/test/ui/**`
- optional runtime docs that describe dashboard behavior

### Scaffold Mirrors

- `scaffold/apps/agentic-ops-dashboard/app.vue`
- `scaffold/apps/agentic-ops-dashboard/app/pages/index.vue`
- `scaffold/apps/agentic-ops-dashboard/app/components/**`
- `scaffold/apps/agentic-ops-dashboard/app/assets/styles/main.css`
- `scaffold/apps/agentic-ops-dashboard/app/composables/**`
- `scaffold/apps/agentic-ops-dashboard/app/utils/**`
- mirrored test surfaces where required

## Validation Strategy

Focused validation for this slice must cover:

- locale switching without full reload as the normal interaction path
- persisted language preference after reload
- fallback behavior for invalid or missing stored locale values
- translated shell rendering across key dashboard components
- layout resilience for longer translated strings
- non-regression of realtime feedback, task detail loading, explicit relations,
  and governed `.resources/` action clarity
- changed-surface parity between live and `scaffold/`

## Risks and Mitigations

- **Copy drift**: if strings remain distributed, English and Spanish will drift.
  Mitigation: centralize shell copy in one dictionary layer.
- **Status ambiguity**: translated labels may hide source semantics.
  Mitigation: keep source values intact and translate only the presentation.
- **Layout overflow**: Spanish copy may break carefully tuned layouts.
  Mitigation: validate responsive behavior and prioritize flexible spacing.
- **Operational regression**: visual refresh could make governed actions less
  obvious or less safe. Mitigation: preserve explicit warning emphasis and test
  those surfaces directly.
- **Parity drift**: runtime mirrors can diverge. Mitigation: treat live versus
  `scaffold/` parity as a planning and validation requirement.