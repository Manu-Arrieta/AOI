---
description: "Export a governed memory version into a compressed bundle under .exportsmemories/."
agent: supervisor
---

# /export-memory-bundle — Export Memory Bundle

Export a governed workspace memory version into a portable gzipped JSON bundle
inside `.exportsmemories/`.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall + Resolve Current State

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "memory bundle export provenance scopes", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "bundle transport lifecycle offline import", topic: "{WORKSPACE}-architecture")
node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Source version ID** — explicit memory version to export
2. **Selected scopes** — `memories`, `memoir`, `feedback`, or `all`
3. **Artifact path** — file name or subpath relative to `.exportsmemories/`
4. **Export context** — why this bundle is being produced and what it should preserve
5. **Related TASK-ID** (optional)

### Step 3: Validate Preconditions

- Ensure `.specify/memory/versions/active.json` and `.exportsmemories/` exist.
- Refuse the export if `sourceVersionId` is missing.
- Refuse unsupported scopes outside `memories`, `memoir`, `feedback`.
- Refuse any artifact path that escapes `.exportsmemories/`.
- Refuse file names that do not end with `.memory-bundle.json.gz`.

### Step 4: Materialize the Bundle

1. Run `scripts/memory-sync/export-memory-bundle.mjs` for the current workspace.
2. Keep the artifact inside `.exportsmemories/`.
3. Present the included and omitted scopes plus the final bundle path.

Persist the export checkpoint:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Memory Bundle Exported\n**Source**: {WORKSPACE}@{sourceVersionId}\n**Scopes**: included={includedScopes}; omitted={omittedScopes}\n**Bundle Path**: .exportsmemories/{relativeArtifactPath}\n**Owner Context**: {exportContext}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 5: Confirm

- Confirm the exported bundle path.
- Confirm the source workspace and source version.
- Confirm included and omitted scopes.
- Remind the Owner that the artifact is transport-only until an explicit import
  prepares a candidate in a destination workspace.

**Export a compressed memory bundle for:**
{{input}}