# Move Resource Folder (Antigravity)

> Antigravity mirror of `.github/prompts/move-resource-folder.prompt.md`. Logic is identical.

Move a governed folder inside `.resources/` without breaking the resources contract.

## Activation

This skill activates when the user says: "move-resource-folder", "mover carpeta de recursos", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "resource structure resources constitution", topic: "{WORKSPACE}-context")
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Source path** — existing folder path inside `.resources/`
2. **Destination path** — new folder path inside `.resources/`
3. **Reason** — why the folder is being moved
4. **Related TASK-ID** (optional)

### Step 3: Validate Scope

- Ensure `.resources/constitution.md` exists.
- Confirm both source and destination remain inside `.resources/`.
- Refuse moves involving `constitution.md`.
- Refuse moving mandatory default folders unless `.resources/constitution.md`
  explicitly permits it.
- Refuse when the source does not exist or the destination already exists.

### Step 4: Move Folder + Update Contract

1. Move the folder.
2. Update `.resources/constitution.md` so the declared structure reflects the
   new path.
3. If the moved folder is part of the default installed baseline, mirror the
   same change under `scaffold/.resources/`.

### Step 5: Persist in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Resources Structure Update\n**Operation**: move\n**From**: .resources/{source}\n**To**: .resources/{destination}\n**Reason**: {reason}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 6: Confirm

> "Resource folder moved from `{source}` to `{destination}`. Constitution and ICM are in sync."