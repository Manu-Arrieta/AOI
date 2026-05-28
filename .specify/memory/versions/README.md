# Memory Version Store

This directory materializes the active and historical memory versions used by a
workspace once version-aware memory synchronization is enabled.

## Structure

```text
.specify/memory/versions/
├── README.md
├── active.json
├── manifests/
├── constitutions/
└── templates/
```

Exported memory bundle artifacts live under `.exportsmemories/` in the
repository root and are treated as runtime transport artifacts rather than part
of the active version store.

## Rules

- `active.json` is the only canonical pointer for the active memory version of a
  workspace.
- Files under `manifests/` are immutable once a version becomes active.
- Files under `constitutions/` are dynamic snapshots tied to a specific memory
  version and are referenced by manifests.
- Templates under `templates/` define the minimum contract for new versioned
  memory workflows, including memory version manifests and portable memory
  bundles.
- Rollback does not mutate a manifest in place; it re-points the active
  workspace state to a previously valid version and records that transition.
- Portable memory bundles declare included and omitted scopes, provenance, and
  integrity metadata before they can be imported as a candidate version.