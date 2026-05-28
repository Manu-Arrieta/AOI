# Functional Requirements: Agentic Operations Dashboard (TASK-2026-002)

## Summary

Introduce an internal web-based dashboard that provides real-time visibility
into the workspace's agentic operations. The dashboard must expose tasks, their
states, artifacts, and contextual relations, including explicit links between
tasks and governed reusable resources such as user stories and workflows.
Initial interaction must focus strictly on governed operations around the
`.resources/` subsystem, preserving the repository's governance model and audit
expectations.

## Problem

The current operational state of the workspace is distributed across markdown
registries, task-specific artifact folders, and the governed `.resources/`
subtree. Understanding the status of active work, the artifacts attached to
each task, and the relationship between ephemeral task execution and reusable
resources requires manual inspection of files and directories. There is no
single, real-time operational view that makes this state legible or safely
enables governed interaction from one place.

## Goals

- Provide an internal dashboard tailored to the current workspace.
- Surface real-time visibility of tasks, statuses, artifacts, and related
  operational context.
- Display explicit relations between tasks and reusable governed resources,
  especially user stories and workflows.
- Allow initial governed interaction around `.resources/` from the dashboard.
- Preserve repository governance, traceability, and task artifact boundaries.
- Establish a foundation that can expand toward broader governed interaction in
  future iterations.

## Non-Goals

- Prescribing the exact frontend framework, transport mechanism, package
  manager, or runtime topology for the dashboard implementation.
- Replacing `.tasks/registry.md` or task artifact folders as the authoritative
  source of truth.
- Inferring task-to-resource relations from unstructured free text without an
  explicit reliable contract.
- Enabling unrestricted write access from the dashboard into arbitrary files or
  directories in the workspace.
- Forcing every task to depend on `.resources/` or requiring related resources
  to exist for the dashboard to function.

## User Stories

1. **As the Owner**, I want to see all current and archived tasks in one place,
   so that I can understand the operational state of the workspace at a glance.
2. **As the Owner**, I want to inspect the artifacts associated with a task, so
   that I can quickly understand what has been produced and what stage that task
   has reached.
3. **As the Owner**, I want to see which user stories and workflows are related
   to a task when those relations exist, so that I can understand the broader
   context and dependencies of the work.
4. **As the Owner**, I want to browse the governed `.resources/` subtree from
   the dashboard, so that I can discover and inspect reusable project context
   without manually navigating the filesystem.
5. **As the Owner**, I want the initial interactive actions in the dashboard to
   stay constrained to governed operations on `.resources/`, so that I can act
   safely without bypassing repository rules.

## Functional Requirements

- **Workspace Dashboard Availability**: The system must provide an internal
  dashboard dedicated to the current workspace and its operational state.
- **Real-Time Task Visibility**: The dashboard must reflect task and artifact
  state changes in near real time, without relying on manual page refresh as
  the normal way to observe updates.
- **Task Inventory View**: The dashboard must expose the known task inventory,
  including at minimum task identity, feature membership, lifecycle state, and
  relevant timeline metadata that already exists in project sources of truth.
- **Task Artifact Visibility**: The dashboard must show the artifacts attached
  to a task in a way that makes each task's deliverables inspectable from the UI.
- **Relation Visibility**: When a task has an explicit relation to a reusable
  resource such as a user story or workflow, the dashboard must display that
  relation clearly. When no relation exists, the dashboard must degrade
  gracefully rather than imply hidden context.
- **Resources Exploration**: The dashboard must provide navigable visibility of
  the governed `.resources/` subtree and distinguish its relevant categories in
  a way that preserves their intended meaning.
- **Governed Resource Interaction**: The initial interactive scope of the
  dashboard must be limited to governed operations around `.resources/` and
  must honor the repository's existing administrative and governance rules.
- **Source of Truth Preservation**: The dashboard must read from and align with
  existing authoritative task and resource surfaces rather than creating a
  parallel, conflicting state model.
- **Future Interaction Headroom**: The functional contract must leave room for
  future governed interactions beyond the initial resource scope without
  invalidating the first iteration's behavior.

## Constraints

- The dashboard is an internal workspace-facing surface, not a standalone
  external product.
- `.tasks/registry.md` and task-local artifacts remain the authoritative task
  sources of truth.
- `.resources/` remains a governed subtree; dashboard interactions cannot
  bypass its established operating rules.
- Task-to-resource relations must rely on an explicit reliable mechanism rather
  than heuristic parsing of arbitrary prose.
- The absence of related resources for a task must not break the dashboard.
- The dashboard must preserve auditability and traceability for governed
  interactions it enables.

## Acceptance Signals

- The Owner can open the dashboard and identify the current lifecycle state of
  tasks without manually traversing the repository tree.
- The Owner can inspect the known artifacts attached to a task from the
  dashboard.
- A task with explicit related user stories or workflows shows those links in
  the UI; a task without such relations still renders cleanly.
- The dashboard exposes the `.resources/` subtree in a navigable way that makes
  reusable context visible.
- Initial interactive actions on `.resources/` remain governed and traceable.
- Operational changes in the workspace become visible through the dashboard in
  near real time.

## Risks/Dependencies

- **Relation Contract Dependency**: The dashboard depends on a canonical way to
  represent task-to-resource relations; without it, relation visibility will be
  unreliable.
- **Format Stability**: If task artifact or registry formats drift without an
  explicit contract, dashboard visibility can become inconsistent.
- **Governance Risk**: If the UI bypasses governed channels for resource
  interaction, it will violate repository rules and erode auditability.
- **Realtime Semantics**: The product must clarify the boundary between current
  operational snapshot and any future historical view of changes over time.