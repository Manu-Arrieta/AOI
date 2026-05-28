# Feature Specification: Agentic Operations Dashboard

**Feature Branch**: `2026-002-agentic-ops-dashboard`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Add an internal real-time dashboard to visualize workspace tasks, artifacts, states, and explicit relations to reusable resources, with governed interaction starting in `.resources/`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Operations Visibility (Priority: P1)

As the Owner, I want to see current and archived tasks, their states, and their
artifacts in a real-time dashboard, so that I can understand the operational
state of the workspace without manually traversing the repository.

**Why this priority**: Real-time visibility is the primary reason to introduce
the dashboard and the foundation for every later interactive capability.

**Independent Test**: This story is independently testable by changing task
state or task artifacts through normal workspace operations and confirming the
dashboard reflects those changes without a manual browser refresh.

**Acceptance Scenarios**:

1. **Given** an active workspace, **When** a task lifecycle state changes in the
   authoritative registry, **Then** the dashboard updates automatically to show
   the new state.
2. **Given** a selected task in the dashboard, **When** the Owner inspects it,
   **Then** the known artifacts associated with that task are visible and
   inspectable.

---

### User Story 2 - Explicit Task-to-Resource Relations (Priority: P1)

As the Owner, I want to see which user stories and workflows are related to a
task, so that I can understand the broader context and dependencies of that
work without relying on memory or prose interpretation.

**Why this priority**: Relationship visibility is essential to connect
ephemeral task execution with governed reusable context and is a core business
value of the dashboard.

**Independent Test**: This story is independently testable by creating a task
that carries explicit relation metadata and confirming those relations render in
the UI, while tasks without relations remain fully usable.

**Acceptance Scenarios**:

1. **Given** a task that has an explicit relation to a reusable user story or
   workflow, **When** the Owner views the task, **Then** the related resources
   are clearly visible in the dashboard.
2. **Given** a task without explicit relations, **When** the Owner views the
   task, **Then** the dashboard degrades gracefully and does not infer hidden
   relations from unrelated free text.

---

### User Story 3 - Governed Interaction with Resources (Priority: P2)

As the Owner, I want the initial interactive actions in the dashboard to stay
constrained to governed operations on `.resources/`, so that I can act safely
without bypassing repository rules or mutating task artifacts directly.

**Why this priority**: Interactivity differentiates the dashboard from a static
viewer, but it must begin inside a narrow and already governed boundary.

**Independent Test**: This story is independently testable by invoking a
supported `.resources/` operation from the dashboard and confirming it applies
the same governance, traceability, and blocking behavior expected from the
existing repository workflows.

**Acceptance Scenarios**:

1. **Given** the dashboard resource explorer, **When** the Owner initiates a
   supported governed operation inside `.resources/`, **Then** the operation
   completes while preserving constitution and traceability rules.
2. **Given** the dashboard UI, **When** the Owner attempts to mutate an
   arbitrary task artifact or a path outside `.resources/`, **Then** the action
   is blocked.

---

### Edge Cases

- What happens when `.tasks/registry.md` or task-local metadata is malformed or
  partially unreadable?
- What happens when a relation record references a resource that has been moved
  or deleted?
- What happens when filesystem watch events are missed and the dashboard needs
  to recover to a fresh current snapshot?
- How does the dashboard behave when concurrent CLI and UI actions target the
  same governed resource surface?
- How are large numbers of archived tasks presented without obscuring active
  work?

## Constitution Alignment *(mandatory)*

### Existing Surface Discovery

- Existing services, agents, prompts, templates, or registries affected:
  `.tasks/registry.md`, `.tasks/{feature}/TASK-YYYY-NNN/*.md`,
  `.resources/constitution.md`, the governed resource workflows,
  `setup.sh`, `setup.ps1`, `teardown.sh`, `teardown.ps1`, `README.md`,
  `README.es.md`, `GEMINI.md`, and `scaffold/` mirrors.
- Copilot, Antigravity, and `scaffold/` sync impact: if explicit resource
  relations become part of managed task context, `/sdd-new` and `/sdd-ff`
  guidance plus `scaffold/` mirrors must remain aligned with the installed
  dashboard runtime and its relation contract.
- Tooling and platform impact: the feature introduces a local web application
  runtime and package-management surface while preserving RTK-first shell rules,
  direct ICM persistence, and macOS/Linux/Windows setup symmetry.
- Required follow-up updates: dashboard runtime surfaces, root and scaffold
  workspace metadata, setup and teardown flows, documentation, and task
  workflows that create or maintain explicit relation metadata.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an internal workspace dashboard that reads
  from and aligns with existing authoritative task and resource surfaces.
- **FR-002**: The dashboard MUST surface task state and artifact changes in near
  real time without relying on manual page refresh as the normal observation
  path.
- **FR-003**: The dashboard MUST display current and archived tasks, including
  task identity, feature membership, lifecycle state, and timeline metadata
  already present in authoritative project surfaces.
- **FR-004**: The dashboard MUST allow the Owner to inspect the artifacts
  attached to a selected task.
- **FR-005**: The system MUST use an explicit machine-readable mechanism to
  represent relations between tasks and reusable resources such as user stories
  and workflows.
- **FR-006**: The system MUST NOT infer task-to-resource relations heuristically
  from unstructured prose.
- **FR-007**: The dashboard MUST provide a navigable view of the governed
  `.resources/` subtree.
- **FR-008**: The initial interactive mutation scope of the dashboard MUST be
  limited to supported governed operations on `.resources/`.
- **FR-009**: Task artifacts under `.tasks/` MUST remain read-only from the
  dashboard UI, and unsupported mutations MUST be blocked.
- **FR-010**: The feature MUST preserve existing task and resource sources of
  truth rather than introducing a conflicting parallel state model.
- **FR-011**: The dashboard contract MUST leave room for future governed
  interactions beyond the initial resource scope without invalidating the first
  iteration.

### Key Entities *(include if feature involves data)*

- **Dashboard Application**: The internal web surface that visualizes workspace
  state and exposes controlled interactions.
- **Workspace Snapshot**: The normalized read-model built from authoritative
  task and resource surfaces for dashboard consumption.
- **Task Artifact Record**: The discoverable set of artifacts associated with a
  single task directory.
- **Explicit Relation Record**: The canonical machine-readable metadata that
  links a task to reusable resources.
- **Governed Resource Operation**: A supported dashboard action that mutates the
  `.resources/` subtree while preserving repository rules and auditability.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Task state or artifact changes become visible through the
  dashboard without the Owner performing a browser refresh.
- **SC-002**: The Owner can inspect the known artifact inventory of a task from
  the dashboard.
- **SC-003**: Tasks with explicit relation records reliably display linked user
  stories and workflows, and tasks without such records render safely.
- **SC-004**: The `.resources/` subtree is traversable visually through the
  dashboard.
- **SC-005**: Supported dashboard actions on `.resources/` preserve governance,
  traceability, and audit expectations.
- **SC-006**: Attempts to mutate unsupported task artifacts or paths outside
  `.resources/` from the UI are blocked.

## Assumptions

- A canonical relation record can be stored alongside the task it describes and
  maintained by task workflows when explicit `.resources/` links exist.
- The dashboard remains an internal local workspace surface rather than an
  externally exposed product.
- Supported host operating systems provide sufficient filesystem observability
  for near-real-time updates.
- Adding a managed Node-based runtime to the infrastructure is acceptable as
  long as setup, teardown, scaffold, and documentation stay synchronized.