# New Resource Folder (Antigravity)

> Antigravity mirror of `.github/prompts/new-resource-folder.prompt.md`. Logic is identical.

Create a new governed folder inside `.resources/`.

## Activation

This skill activates when the user says: "new-resource-folder", "crear carpeta de recursos", or similar.

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

1. **Folder name** — short kebab-case identifier
2. **Parent path** — path inside `.resources/` (default: `.resources/`)
3. **Purpose** — what kind of reusable context this folder will store
4. **Related TASK-ID** (optional)

### Step 3: Validate Scope

- Ensure `.resources/constitution.md` exists before mutating anything.
- Resolve the target path and confirm it stays inside `.resources/`.
- Refuse names that collide with `constitution.md` or an existing path.
- Refuse creation outside `.resources/`.

### Step 4: Create Folder + Update Contract

1. Create the requested folder.
2. Update `.resources/constitution.md` so the declared structure matches the new
   folder and its stated purpose.
3. If the folder becomes part of the default installed baseline, mirror the same
   structure and contract update under `scaffold/.resources/`.

### Step 5: Persist in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Resources Structure Update\n**Operation**: create\n**Path**: .resources/{path}\n**Purpose**: {purpose}\n**Related Task**: {TASK-ID or None}"
)
```

### Step 6: Confirm

> "Resource folder `{path}` created. Constitution and ICM are in sync."