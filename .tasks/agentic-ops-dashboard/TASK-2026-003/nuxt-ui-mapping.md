# Nuxt UI Mapping — TASK-2026-003

## Dependency Baseline

- `nuxt` stays on `4.4.6`, which matches the latest stable published version.
- `@nuxt/ui` was added at `4.8.0`.
- `tailwindcss` was added at `^4.3.0` as required by Nuxt UI v4.

## Component-by-Component Mapping

| Current surface | User intent | Nuxt UI components | Why this fit works |
| --- | --- | --- | --- |
| `app.vue` | global overlay support | `UApp` | Required for modal and future overlay patterns. |
| `app/pages/index.vue` | clear shell, locale switch, operational KPI strip, resizable workspace columns, visible layout reset | `UCard`, `UTabs`, `UButton`, `UProgress`, `UAlert`, `UDashboardGroup`, `UDashboardPanel` | Keeps the current data flow, replaces bespoke shell primitives with maintainable dashboard-ready surfaces, persists the three primary workspace column widths locally, and exposes a direct reset control that clears the stored panel sizes. |
| `TaskBoard.vue` | scannable task inventory | `UCard`, `UBadge` | Gives the board a stable container and clearer task counts. |
| `TaskSummaryCard.vue` | richer task cards with stronger status hierarchy | `UCard`, `UBadge` | Status, warnings, artifacts, and relations now read as explicit chips instead of raw text blocks. |
| `TaskDetailPanel.vue` | lower cognitive load while preserving context | `UCard`, `UTabs`, `UAlert`, `UBadge` | Tabs separate relations from artifacts without resetting the selected task or artifact. |
| `TaskRelationsPanel.vue` | explicit relation visibility | `UCard`, `UBadge` | Relation health is now a status chip problem, not a text parsing problem. |
| `ArtifactList.vue` | easier artifact scan | `UCard`, `UBadge` | Artifact kind becomes visible immediately and consistent with the rest of the dashboard. |
| `ArtifactViewer.vue` | clearer preview feedback states | `UCard`, `UAlert`, `UBadge` | Empty, directory, and no-preview states now use explicit callout patterns. |
| `ResourceExplorer.vue` | governed actions with better ergonomics | `UCard`, `UContextMenu`, `UButton`, `UBadge` | Right-click context actions match the operational nature of governed resource edits while keeping visible buttons for clarity. |
| `ResourceActionDialog.vue` | safer action confirmations | `UModal`, `UFormField`, `UInput`, `UTextarea`, `UCheckbox`, `UButton`, `UAlert` | Modal semantics and form primitives make destructive confirmation harder to misread. |

## Graphics Decision

Nuxt UI `4.8.0` does **not** expose first-party chart components in the public component catalog.

For this slice, the dashboard should use lightweight operational graphics built from:

- `UProgress` for live ratios and completion-style signals
- `UBadge` for compact status encoding
- `UTabs` and `UAlert` for decision-oriented hierarchy rather than decorative analytics

If the dashboard later needs true line, area, bar, or sparkline charts, that should be a separate subtask with a dedicated charting library and a validated data model for time-series or aggregate metrics.

## Why `UContextMenu` Is The Right Call Here

The resource explorer is the only surface where the user performs governed write actions over a hierarchical structure. A context menu is a natural fit because it:

- scopes actions to the exact directory under inspection
- groups safe actions apart from destructive actions
- reduces persistent visual noise in a dense explorer
- keeps the primary screen focused on state, not buttons

Visible buttons are still preserved for clarity and discoverability, so the menu augments the workflow instead of hiding it.

## Follow-up Candidates

- Introduce a dedicated chart library only if the product confirms real analytics requirements beyond KPI strips and ratios.