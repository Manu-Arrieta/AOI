# Resources Constitution

## Authority

- This document governs only the `.resources/` subtree.
- It is subordinate to `.specify/memory/constitution.md`, which remains the
  top-level authority for the project.

## Required Structure

The managed default structure is:

```text
.resources/
├── constitution.md        ← This governance document (auto-synced via /update-resource-governance-structure)
├── userstories/           ← Reusable user-story context for task construction and ICM ingestion
└── workflows/             ← Component interaction definitions spanning one or more user stories
```

### Folder Descriptions

#### `userstories/`

Stores reusable user-story documents. Each file describes a discrete user need
from the perspective of an actor (e.g. "As an administrator, I want to…").

- Files are linked explicitly to tasks via `relations.json` — never auto-ingested
- The **Resource Analyst** (`@resource-analyst`) scans this folder to extract
  actor, goal, value, constraints, and related modules, then stores each story
  as a concept in the `{WORKSPACE}-resources` memoir graph
- Cross-story relationships (e.g. `depends_on`, `related_to`) are mapped by
  the Resource Analyst based on textual evidence

#### `workflows/`

Stores component interaction definitions. Each file describes how parts of the
system interact within one user story or across multiple user stories.

- Files are **descriptive only** — never executable commands, shell macros, or
  workflow automations
- The **Resource Analyst** scans this folder to extract trigger, components,
  steps, touched user stories, and outcome, then links each workflow to its
  related user stories in the `{WORKSPACE}-resources` memoir graph

## Semantics

- Content under `.resources/` is contextual input only.
- Files inside `workflows/` are never executable commands, shell macros, or
  workflow automations.
- Task-construction flows may use resources only when the Owner explicitly
  links them via `relations.json`.
- The `{WORKSPACE}-resources` memoir in ICM is the canonical knowledge graph
  of all resources and their relationships. It is maintained by the Resource
  Analyst and should be refreshed when new files are added.

## Mutation Rules

- Structural changes inside `.resources/` must go through the dedicated
  administrative workflows (`/new-resource-folder`, `/move-resource-folder`,
  `/delete-resource-folder`).
- Any structural mutation must update this file and persist the resulting state
  in workspace-scoped ICM context.
- Default folders remain part of the managed baseline unless an updated
  governing workflow and the root constitution explicitly allow otherwise.
- After any structural change, run `/update-resource-governance-structure` to
  re-sync this document, then run `@resource-analyst` to refresh the ICM
  memoir graph.

## ICM Integration

| Memoir / Topic | Purpose |
|----------------|---------|
| `{WORKSPACE}-resources` | Knowledge graph of all user stories and workflows with typed relationships |
| `{WORKSPACE}-resources-catalog` | Episodic memory of each scanned resource file (actor, goal, components, etc.) |

## Last Synchronized

- **Date**: 2026-06-15
- **Operation**: `/update-resource-governance-structure`
- **Triggered by**: Owner — initial governance sync after Resource Analyst integration
- **Folders detected**: `userstories/`, `workflows/`
- **Status**: ✅ Structure matches declaration — no divergence detected
