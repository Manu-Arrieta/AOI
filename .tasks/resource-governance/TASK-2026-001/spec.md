# Feature Specification: Resource Governance

**Feature Branch**: `2026-001-resource-governance`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Agregar a la infraestructura agéntica una carpeta de recursos internos con dos subcarpetas iniciales, `userstories/` y `workflows/`, y operaciones de administración `/new-resource-folder`, `/move-resource-folder`, `/delete-resource-folder`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opt-In Reusable User Stories (Priority: P1)

As the Owner, I want to store reusable user stories in `.resources/userstories/`
and selectively link them to tasks during task construction, so that I do not
repeat definitions but maintain autonomy and speed when creating tasks that do
not depend on historical context.

**Why this priority**: Linking reusable knowledge into task scaffolding without
introducing a hard dependency is the primary value of the feature.

**Independent Test**: This story is independently testable by creating a task
without any linked resources and confirming it proceeds normally, then creating
another task where the Owner explicitly links a file from
`.resources/userstories/` and confirming that the linked artifact is included as
context.

**Acceptance Scenarios**:

1. **Given** a task construction prompt without resource links, **When** the
   Owner starts a task workflow, **Then** the task planning succeeds without any
   automatic read of `.resources/`.
2. **Given** a task construction prompt that explicitly links
   `.resources/userstories/example.md`, **When** the workflow is executed,
   **Then** the linked user story is ingested as contextual input for the task.

---

### User Story 2 - Governed Administrative Workflows (Priority: P1)

As the Supervisor or Agent, I need explicit administrative workflows
(`/new-resource-folder`, `/move-resource-folder`, `/delete-resource-folder`) to
govern the lifecycle of resource folders, so that `.resources/constitution.md`
and ICM reflect the real structure without silent drift.

**Why this priority**: The resources subsystem cannot be governed reliably if
its structure is created or changed outside explicit workflows.

**Independent Test**: This story is independently testable by invoking one
administrative workflow, confirming the folder tree changes as requested,
confirming the local resources constitution reflects the change, and confirming
an ICM update is recorded.

**Acceptance Scenarios**:

1. **Given** the workspace root, **When** `/new-resource-folder` is used to
   create `templates/` under `.resources/`, **Then** the folder exists and the
   change is recorded inside `.resources/constitution.md`.
2. **Given** a structural change within `.resources/`, **When** an
   administrative workflow completes, **Then** the resulting structure is also
   persisted as project context in ICM.

---

### User Story 3 - Component Interaction Definitions (Priority: P2)

As the Owner, I want to define component interaction sequences in
`.resources/workflows/`, so that I can reference interaction design across one
or many user stories instead of rewriting the same coordination logic in every
task.

**Why this priority**: Reusable workflow resources expand the value of the new
subsystem, but depend on the base governance model already existing.

**Independent Test**: This story is independently testable by linking a file
from `.resources/workflows/` into a task and confirming it is interpreted as a
functional interaction definition rather than as an executable command.

**Acceptance Scenarios**:

1. **Given** a component interaction definition stored in
   `.resources/workflows/checkout.md`, **When** the Owner explicitly links it to
   a task, **Then** the task consumes it as functional guidance for component
   interaction.
2. **Given** a file inside `.resources/workflows/`, **When** the system ingests
   it during task construction, **Then** it is never treated as an executable
   shell or system command.

---

### Edge Cases

- What happens when the Owner links a resource path that does not exist?
- What happens when someone manually edits `.resources/constitution.md` outside
  the administrative workflows?
- How does the system handle attempts to delete or move mandatory default
  folders such as `userstories/` and `workflows/`?
- What happens when content stored under `.resources/workflows/` looks like an
  executable command instead of an interaction definition?

## Constitution Alignment *(mandatory)*

### Existing Surface Discovery

- Existing services, agents, prompts, templates, or registries affected:
  `.specify/memory/constitution.md`, `.github/prompts/sdd-new.prompt.md`,
  `.agent/skills/sdd-new/SKILL.md`, `.github/prompts/sandbox-new.prompt.md` as
  the closest workflow pattern, `.atl/skill-registry.md`, `GEMINI.md`, setup
  and teardown scripts.
- Copilot, Antigravity, and `scaffold/` sync impact: new administrative
  workflows must be introduced in both `.github/prompts/` and `.agent/skills/`,
  documented in both root and `scaffold/` registries and guidance files, and
  any installed default structure must be mirrored in `scaffold/`.
- Tooling and platform impact: ICM needs explicit state tracking for the new
  resources structure; setup and teardown must stay symmetric across macOS,
  Linux, and Windows; non-interactive shell commands remain subject to `rtk`.
- Required follow-up updates: `README.md`, `README.es.md`, `GEMINI.md`,
  `.atl/skill-registry.md`, root and `scaffold/` workflow registries and
  guidance, plus validation assets for the new workflow surfaces.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a governed `.resources/` directory at the
  project root populated by default with `userstories/` and `workflows/`.
- **FR-002**: Task construction workflows MUST NOT require `.resources/` to be
  read or linked in order to proceed.
- **FR-003**: The Owner MUST be able to explicitly link one or more resources
  from `.resources/` during task construction when additional context is
  desired.
- **FR-004**: The system MUST expose three distinct user-facing workflows for
  structural operations within `.resources/`: `/new-resource-folder`,
  `/move-resource-folder`, and `/delete-resource-folder`.
- **FR-005**: Administrative workflows affecting `.resources/` MUST update
  `.resources/constitution.md` so that the documented structure matches the
  actual structure.
- **FR-006**: The root constitution at `.specify/memory/constitution.md` MUST
  explicitly delegate subordinate governance for the `.resources/` subtree to
  `.resources/constitution.md` without ceasing to be the top-level authority.
- **FR-007**: The system MUST persist structural changes to `.resources/` in ICM
  using workspace-scoped project context so that the current resource state is
  recoverable in later phases.
- **FR-008**: The `.resources/workflows/` directory MUST be reserved for
  component interaction definitions within one user story or across multiple
  user stories and MUST NOT be treated as a repository of executable commands.
- **FR-009**: The `.resources/userstories/` directory MUST be available for
  reusable user-story resources that can be linked into task construction only
  on explicit Owner request.

### Key Entities *(include if feature involves data)*

- **Resource Repository**: The `.resources/` root subtree that stores reusable
  task-construction context outside `.tasks/`.
- **Resource Constitution**: The `.resources/constitution.md` contract that
  governs allowed structure and rules inside `.resources/`, under the authority
  of the root constitution.
- **Resource Folder Workflow**: A user-facing workflow that performs a
  structural create, move, or delete operation inside `.resources/` while
  keeping governance and ICM synchronized.
- **Resource Record**: A reusable artifact stored inside `.resources/`, such as
  a user story file or a component interaction definition.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new task can be created and planned successfully without any
  automatic read of `.resources/`.
- **SC-002**: A task can consume an explicitly linked file from
  `.resources/userstories/` as contextual input without requiring unrelated
  resources.
- **SC-003**: A task can consume an explicitly linked file from
  `.resources/workflows/` as functional interaction guidance rather than as an
  executable command.
- **SC-004**: Each administrative resource workflow updates the folder tree,
  updates `.resources/constitution.md`, and records the resulting state in ICM.
- **SC-005**: Root and `scaffold/` workflow surfaces remain synchronized after
  the feature is introduced.

## Assumptions

- Task-construction workflows can accept explicitly referenced resource paths as
  optional contextual inputs.
- The default folders `userstories/` and `workflows/` remain protected or
  specially governed by the resources constitution once it exists.
- Manual edits outside the administrative workflows are treated as drift to be
  resolved by governance rather than automatically reconciled in this feature.
- The repository will continue to treat root and `scaffold/` copies as a single
  synchronized product surface for shared workflow changes.