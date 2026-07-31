---
name: memory-governance
description: ICM memory versioning, bundle export/import, sync across workspaces, and rollback flows. Use when running /export-memory-bundle, /import-memory-bundle, /sync-workspace-memory, /rollback-workspace-memory, or when troubleshooting ICM state.
---

# Memory Governance — Versioned ICM Operations

AOI uses governed memory versioning for workspaces registered in `.specify/memory/versions/active.json`. This skill describes the lifecycle of memory versions, bundles, sync, and rollback.

## Version Architecture

```
.specify/memory/versions/
├── active.json                    # Canonical active version pointer
├── manifests/
│   └── {version-id}.json          # Immutable version manifest
├── bundles/
│   └── {version-id}.json.gz       # Exported portable bundles
└── templates/
    ├── memory-version.template.json
    ├── memory-bundle.template.json
    └── dynamic-constitution.template.md
```

`.exportsmemories/` is where portable bundles land for cross-workspace transfer.

## Core Scripts

All scripts live in `scripts/memory-sync/`:

| Script                         | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `resolve-active-version.mjs`   | Read active version for workspace        |
| `prepare-version-manifest.mjs` | Create a new version manifest            |
| `activate-version.mjs`         | Set a version as active                  |
| `export-memory-bundle.mjs`     | Export active version to portable bundle |
| `import-memory-bundle.mjs`     | Import a bundle as a candidate version   |
| `rollback-version.mjs`         | Restore previous version                 |
| `bundle-contract.test.mjs`     | Validate bundle schema                   |
| `bundle-lifecycle.test.mjs`    | Validate full lifecycle                  |

## Bundle Lifecycle

### Export (`/export-memory-bundle`)

1. Resolve active version: `node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"`
2. Ask Owner for scope: `full` or `topic-subset`
3. Run `node scripts/memory-sync/export-memory-bundle.mjs` with version ID + scope
4. Bundle lands in `.exportsmemories/{workspace}-{versionId}.json.gz`
5. Store provenance in ICM

### Import (`/import-memory-bundle` or `/sync-workspace-memory`)

1. Detect source (bundle file for import, workspace for sync)
2. Validate schema: `node scripts/memory-sync/bundle-contract.test.mjs`
3. Create candidate version via `import-memory-bundle.mjs`
4. **Gate**: Candidate version is NOT active yet — Owner must approve
5. Owner activates via `/sync-workspace-memory` confirmation
6. Dynamic constitution is updated from snapshot

### Rollback (`/rollback-workspace-memory`)

1. Resolve active version + confirm `previousVersionId`
2. **Safety check**: validate previous version integrity
3. Run `node scripts/memory-sync/rollback-version.mjs "$WORKSPACE" "$targetVersionId"`
4. Must provide `reason` for rollback
5. Active pointer is updated atomically

## Critical Constraints

- Manifests under `.specify/memory/versions/manifests/` are **immutable** — never edit them
- `active.json` is the **single source of truth** for which version is active
- Dynamic constitution snapshots MUST match the manifest they belong to
- Rollback targets ONLY the registered `previousVersionId` — not arbitrary versions
- Sync/import flows MUST declare `sourceWorkspace` + `sourceVersionId`

## ICM Topics for Memory Governance

Always store operations under:

- `{WORKSPACE}-context` for version activation changes
- `{WORKSPACE}-architecture` for memoir graph updates after sync
- `sdd-{WORKSPACE}-memory-ops` for operational logs of bundle/sync/rollback
