---
description: "Delete a governed folder inside .resources and persist the structural change."
agent: "agent"
---

# /delete-resource-folder — Delete Resource Folder

Delete a governed folder inside `.resources/` while preserving the resources
contract and audit trail.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "resource structure resources constitution", topic: "{WORKSPACE}-context")
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Target path** — existing folder path inside `.resources/`
2. **Reason** — why the folder should be removed
3. **Related TASK-ID** (optional)
4. **Confirmation** — explicit confirmation that deletion is intended

### Step 3: Validate Scope

- Ensure `.resources/constitution.md` exists.
- Confirm the target path stays inside `.resources/`.
- Refuse deletion of `constitution.md`.
- Refuse deleting mandatory default folders unless `.resources/constitution.md`
  explicitly permits it.
- Refuse when the target folder does not exist.

### Step 4: Delete Folder + Update Contract

1. Delete the requested folder after explicit confirmation.
2. Update `.resources/constitution.md` so the declared structure no longer
   includes the removed folder.
3. If the deleted folder is part of the default installed baseline, mirror the
   same removal under `scaffold/.resources/`.

### Step 5: Persist in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Resources Structure Update\n**Operation**: delete\n**Path**: .resources/{target}\n**Reason**: {reason}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 6: Confirm

> "Resource folder `{target}` deleted. Constitution and ICM are in sync."

**Delete a resource folder for:**
{{input}}