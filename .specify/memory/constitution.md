<!--
Sync Impact Report
Version change: 1.2.0 -> 1.3.0
Modified principles:
- None
Modified sections:
- Operational Constraints (added bounded delegation to .sandboxes/{name}/constitution.md)
Added sections:
- None
Removed sections:
- None
Templates requiring updates:
- ✅ updated: scaffold/.specify/memory/constitution.md
- ✅ added: .sandboxes/_templates/constitution.template.md (+ scaffold mirror)
Follow-up TODOs:
- None
-->
# AOI Constitution

## Core Principles

### I. Dual-Sync First
Any change to agents, skills, prompts, registries, or workflow guidance MUST keep
Copilot and Antigravity artifacts semantically equivalent. When a change affects
what this repository installs, the live repository copy and the `scaffold/`
mirror MUST be updated in the same change. Rationale: AOI ships an
ecosystem, not isolated files, and drift breaks downstream projects silently.

### II. ICM-Centered Execution
Every meaningful workflow MUST start with workspace-scoped ICM recall and MUST
end with explicit persistence of decisions, resolved errors, and phase results.
Architecture changes MUST be stored both as episodic memory and as memoir
concepts; incorrect assumptions MUST be recorded as feedback; transcript capture
is limited to Explore and Archive phases unless a stricter project rule says
otherwise. When a workspace adopts versioned memory, operational recall and
write flows MUST resolve either the explicit target version or the canonical
active version before touching workspace memory aliases. Rationale: persistent
context is a core product capability and must be demonstrated by the project
itself.

### III. Spec-Kit Governs Delivery
Non-trivial work MUST follow the Spec-Kit lifecycle: constitution, specify or
clarify, plan, tasks, implement, verify, and archive. Service discovery MUST
precede requirement authoring, and every feature artifact MUST align with the
constitution instead of bypassing it. Owner approval gates MUST remain explicit
between major phases. Rationale: the project's primary value is a reliable SDD
workflow, so internal work must model that workflow faithfully.

### IV. RTK-First, Cross-Platform Tooling
All non-interactive shell commands MUST use `rtk`; `icm` and `specify` commands
MUST be invoked directly; OS-specific absolute paths MUST NOT be hardcoded.
Changes to setup scripts, prompts, or documentation MUST preserve macOS, Linux,
and Windows 11+ viability inside VS Code. Interactive terminal flows MAY bypass
`rtk` only when terminal behavior requires it. Rationale: token efficiency and
environment portability are non-negotiable product guarantees.

### V. Verification Over Drift
Every change MUST include the narrowest executable validation available and MUST
update dependent templates, registries, and guidance files before completion.
Breaking changes to workflow, artifact paths, or protocol expectations MUST add
an explicit migration note and use semantic versioning for the changed contract.
Memory-version activation changes MUST leave behind rollback-safe artifacts and
a single canonical active pointer. Rationale: AOI ships conventions;
unverified drift degrades both this repository and every generated workspace.

## Operational Constraints

- The authoritative top-level constitution file is
	`.specify/memory/constitution.md`; any subordinate constitution path is drift
	unless this file explicitly delegates a bounded scope to it.
- `.resources/constitution.md`, when present, governs only the `.resources/`
	subtree and MUST NOT override rules defined by the top-level constitution.
- `.sandboxes/{name}/constitution.md`, when present, governs only that single
	sandbox subtree and MUST declare subordination to this top-level constitution;
	it MUST NOT override top-level rules. It is a living, versioned document whose
	only sanctioned mutation in this iteration is a MINOR bump triggered by adding
	a compartment via a `/sandbox-new` re-run, accompanied by a Sync Impact Report
	and a `changelog.md` entry. Any other mutation is drift.
- `.specify/memory/versions/active.json`, when present, is the canonical source
	of truth for the active memory version of each workspace managed under this
	constitution.
- Activated manifests and dynamic constitution snapshots under
	`.specify/memory/versions/` MUST be immutable; later changes require a new
	version activation or an explicit rollback event.
- Changes touching shared agentic infrastructure MUST review the root and
	`scaffold/` copies across `.github/`, `.agent/`, `.atl/`, `.specify/`, and
	setup or teardown scripts when applicable.
- Generated guidance MUST stay generic unless a rule is intentionally tool-
	scoped; assistant-specific wording MUST appear only where the surface is
	actually tool-specific.
- Setup and teardown behavior MUST remain operationally symmetric unless a
	documented platform limitation prevents it.

## Delivery Workflow & Quality Gates

- Initialization MUST verify that `.specify/memory/constitution.md`,
	`.tasks/registry.md`, and the required agent registries exist before handing
	work to downstream phases.
- Specifications MUST document existing surface discovery, dual-sync impact,
	tooling or platform impact, and measurable outcomes before requirements are
	finalized.
- Plans MUST include a constitution check covering dual-sync scope, ICM
	obligations, RTK and platform implications, and focused validation strategy.
- Tasks MUST include mirrored artifact updates, registry or documentation
	maintenance, and validation work whenever shared workflow surfaces change.
- Versioned-memory workflows MUST ship with manifest templates, active-pointer
	validation, and rollback-safe transitions before the feature is considered
	implementation-ready.
- Resource-aware task construction MUST keep `.resources/` linkage explicit;
	resources MUST NOT be auto-ingested when the Owner did not provide them.
- Content under `.resources/workflows/` MUST be treated as contextual
	interaction definitions, never as executable instructions.
- Verify outputs MUST report executed checks, remaining risks, and any required
	memory hygiene actions before a feature is considered complete.

## Governance

- This constitution supersedes conflicting local guidance, except where a
	stricter safety or platform rule already applies.
- Amendments MUST update this file, all affected templates or runtime guidance,
	and the Sync Impact Report in the same change.
- Delegated constitutions MUST declare their scope, authority boundary, and
	mutation rules in the same change that introduces or amends them.
- Versioning policy uses semantic versioning: MAJOR for incompatible governance
	changes, MINOR for new or materially expanded principles or sections, and
	PATCH for clarifications that do not alter compliance expectations.
- Compliance review is mandatory for every change touching shared workflow
	surfaces; reviewers MUST verify constitution alignment, dual-sync parity, and
	validation evidence before approving completion.

**Version**: 1.3.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-06-15
