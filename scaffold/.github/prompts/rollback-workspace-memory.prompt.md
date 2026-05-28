description: "Restore the previous governed memory version for the current workspace with explicit rollback intent."
agent: supervisor

# /rollback-workspace-memory — Roll Back Workspace Memory

Restore the immediately previous governed memory version when the current active
version is degraded, inconsistent, or incorrect.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall + Resolve Active Version

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "memory versions rollback corruption", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "memory governance versioned memory", topic: "{WORKSPACE}-architecture")
node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Target version ID** — the version to restore
2. **Rollback reason** — what corruption, inconsistency, or regression triggered the rollback
3. **Confirmation** — explicit confirmation that the rollback should replace the current active version
4. **Related TASK-ID** (optional)

### Step 3: Validate Preconditions

- Ensure `.specify/memory/versions/active.json` exists.
- Refuse the rollback if the resolver reports no `previousVersionId`.
- Refuse the rollback if `targetVersionId` is missing.
- Refuse the rollback if `targetVersionId` does not match the registered `previousVersionId`.
- Refuse the rollback if the reason or explicit confirmation is missing.

### Step 4: Execute Rollback

1. Restore the target via `scripts/memory-sync/rollback-version.mjs`.
2. Ensure the restored version becomes `active` again.
3. Ensure the previously active manifest becomes `rolled-back`.
4. Ensure `active.json` points back to the restored version and keeps explicit
   traceability to the reverted version.

### Step 5: Persist the Event in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Memory Rollback\n**Restored Version**: {targetVersionId}\n**Rolled Back Version**: {currentVersionId}\n**Reason**: {reason}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 6: Confirm

> "Memory rollback complete. `{targetVersionId}` is active again and `{currentVersionId}` is now marked `rolled-back`."

**Roll back workspace memory for:**
{{input}}