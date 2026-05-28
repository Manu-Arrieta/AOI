# Sync Workspace Memory (Antigravity)

> Antigravity mirror of `.github/prompts/sync-workspace-memory.prompt.md`. Logic is identical.

Import governed memory from another workspace into a new candidate memory
version for the current workspace.

## Activation

This skill activates when the user says: "sync-workspace-memory", "sincronizar memorias", "importar memorias", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall + Resolve Active Version

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "memory versions sync rollback constitution", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "memory governance versioned memory", topic: "{WORKSPACE}-architecture")
node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Source workspace** — workspace that owns the memory to import
2. **Source version ID** — explicit source memory version
3. **Selected scopes** — `memories`, `memoir`, `feedback`, or `all`
4. **Owner context** — why this sync is needed and what it should prioritize
5. **Decision plan** — what to `retain`, `complement`, and `discard`
6. **Activation approval** — whether the candidate may be activated after review
7. **Related TASK-ID** (optional)

### Step 3: Validate Preconditions

- Ensure `.specify/memory/constitution.md` and
  `.specify/memory/versions/active.json` exist.
- Refuse the sync if `sourceWorkspace` or `sourceVersionId` is missing.
- Refuse unsupported scopes outside `memories`, `memoir`, `feedback`.
- Refuse activation until a candidate manifest, dynamic constitution snapshot,
  and explicit Owner review all exist.

### Step 4: Prepare Candidate Version

1. Generate a unique target `versionId` for the current workspace.
2. Materialize a candidate manifest via `scripts/memory-sync/prepare-version-manifest.mjs`.
3. Materialize the dynamic constitution snapshot under
   `.specify/memory/versions/constitutions/{WORKSPACE}/`.
4. Keep the new manifest in `candidate` status.
5. Do **NOT** update `active.json` yet.

Persist the candidate as a governed checkpoint:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Memory Sync Candidate\n**Target Version**: {versionId}\n**Source**: {sourceWorkspace}@{sourceVersionId}\n**Scopes**: {scopes}\n**Owner Context**: {ownerContext}\n**Decisions**: retain={retain}; complement={complement}; discard={discard}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 5: Review + Approval Gate

Present the candidate summary to the Owner, including:

- source workspace and source version
- target version ID
- selected scopes
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
  content: "## Memory Sync Activated\n**Target Version**: {versionId}\n**Source**: {sourceWorkspace}@{sourceVersionId}\n**Scopes**: {scopes}\n**Owner Context**: {ownerContext}\n**Decisions**: retain={retain}; complement={complement}; discard={discard}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 7: Confirm

- If not yet approved: "Memory sync candidate `{versionId}` prepared. Awaiting activation approval."
- If activated: "Memory sync version `{versionId}` activated. Previous version `{previousVersionId}` remains the immediate rollback target."