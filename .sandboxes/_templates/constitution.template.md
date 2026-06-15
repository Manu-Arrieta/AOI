<!--
Sync Impact Report
Version change: 0.0.0 -> 1.0.0
Trigger: sandbox creation via /sandbox-new (CREATE branch)
Modified sections:
- Authority (initial subordination declaration)
- Required Structure (FR-3 layout)
- Compartment Governance (declared compartment(s) at creation)
- Semantics (exploratory-work rules)
- Mutation Rules (baseline v1.0.0 + MINOR-on-compartment trigger)
Added sections: all (initial creation)
Removed sections: none
Follow-up TODOs: none
-->

# Sandbox Constitution — {{SANDBOX_NAME}}

## Authority

- Governs ONLY `.sandboxes/{{SANDBOX_NAME}}/`.
- Subordinate to `.specify/memory/constitution.md`, which remains the top-level
  authority for the project. This document MUST NOT override top-level rules.

## Required Structure

The managed layout for this sandbox is:

```text
.sandboxes/{{SANDBOX_NAME}}/
├── config.md                  ← static identity (IMMUTABLE post-creation)
├── constitution.md            ← this living, versioned governance document
├── integration-manifest.json  ← canonical, machine-validated (skeleton at creation)
├── integration-manifest.md    ← GENERATED human view (never hand-edited)
├── changelog.md               ← amendment history (Sync Impact Reports)
└── exports/                   ← exportable snapshots
```

## Compartment Governance

Each compartment is a typed, multipurpose area of this sandbox. The authoritative
copy of every compartment lives in `integration-manifest.json.compartments[]`;
the blocks below mirror its governance.

<!-- COMPARTMENT_GOVERNANCE_START -->

### {{COMPARTMENT_KIND}}:{{COMPARTMENT_SURFACE}} — {{COMPARTMENT_ID}}

- Scope: {{COMPARTMENT_SCOPE}}
- Stack: {{COMPARTMENT_STACK}}
- Integration target: {{COMPARTMENT_INTEGRATION_TARGET}}
- Migratable chain: {{COMPARTMENT_CHAIN}}
<!-- COMPARTMENT_GOVERNANCE_END -->

## Semantics

- Sandbox work is exploratory; integration is governed by the manifest
  `disposition` of each element, not by prose intent.
- Components, pages, and stores MUST NOT contain runtime selection between real
  and temporary implementations. Temporary behavior lives in sandbox-only
  adapters, fixtures, or explicit environment flags.
- Every migratable element MUST preserve the chain
  UI entrypoint → state boundary → service boundary → execution client/contract
  adapter.

## Mutation Rules

- Baseline version on creation: `v1.0.0`.
- Adding a compartment via a `/sandbox-new` re-run → MINOR bump (`X.(Y+1).0`).
- Every amendment MUST refresh the Sync Impact Report header above AND append a
  row to `changelog.md`.
- `config.md` is immutable and is never modified by an amendment.
- PATCH/MAJOR semantics are not used in this iteration.

**Version**: 1.0.0 | **Created**: {{CREATED_DATE}} | **Last Amended**: {{CREATED_DATE}}
