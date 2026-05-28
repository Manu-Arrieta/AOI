---
description: "Import a compressed memory bundle into a governed candidate version."
agent: supervisor
---

# /import-memory-bundle — Import Memory Bundle

Import a portable memory bundle from `.exportsmemories/` into a new candidate
memory version for the current workspace.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall + Resolve Active Version

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "memory bundle import candidate rollback", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "bundle transport lifecycle offline import", topic: "{WORKSPACE}-architecture")
node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Bundle path** — file name or subpath relative to `.exportsmemories/`
2. **Target version ID** — explicit candidate version identifier
3. **Owner context** — why this bundle should be imported now
4. **Decision plan** — what to `retain`, `complement`, and `discard`
5. **Activation approval** — whether the candidate may be activated after review
6. **Related TASK-ID** (optional)

### Step 3: Validate Preconditions

- Ensure `.specify/memory/versions/active.json` and `.exportsmemories/` exist.
- Refuse the import if `relativeArtifactPath` or `versionId` is missing.
- Refuse any bundle path that escapes `.exportsmemories/`.
- Refuse activation until a candidate manifest exists and the Owner approves it.

### Step 4: Prepare Candidate Version

1. Run `scripts/memory-sync/import-memory-bundle.mjs`.
2. Keep the new manifest in `candidate` status.
3. Do **NOT** update `active.json` yet.
4. Present bundle provenance, included scopes, omitted scopes, and the target
   candidate version.

Persist the candidate checkpoint:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Memory Bundle Candidate\n**Target Version**: {versionId}\n**Bundle Path**: .exportsmemories/{relativeArtifactPath}\n**Source**: {sourceWorkspace}@{sourceVersionId}\n**Scopes**: included={includedScopes}; omitted={omittedScopes}\n**Owner Context**: {ownerContext}\n**Decisions**: retain={retain}; complement={complement}; discard={discard}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 5: Review + Approval Gate

Present the candidate summary to the Owner, including:

- bundle path inside `.exportsmemories/`
- source workspace and source version from bundle provenance
- target version ID
- included and omitted scopes
- Owner context
- `retain` / `complement` / `discard` decisions
- current active version and immediate rollback target

Require explicit Owner approval before activation.

### Step 6: Activate Only If Approved

1. Promote the candidate via `scripts/memory-sync/activate-version.mjs`.
2. Ensure `active.json` points to the new version.
3. Ensure the previous active manifest becomes `superseded`.

Persist the activation:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Memory Bundle Activated\n**Target Version**: {versionId}\n**Bundle Path**: .exportsmemories/{relativeArtifactPath}\n**Source**: {sourceWorkspace}@{sourceVersionId}\n**Scopes**: included={includedScopes}; omitted={omittedScopes}\n**Owner Context**: {ownerContext}\n**Decisions**: retain={retain}; complement={complement}; discard={discard}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 7: Confirm

- If not yet approved: "Memory bundle candidate `{versionId}` prepared. Awaiting activation approval."
- If activated: "Memory bundle version `{versionId}` activated. Previous version `{previousVersionId}` remains the immediate rollback target."

**Import a compressed memory bundle for:**
{{input}}