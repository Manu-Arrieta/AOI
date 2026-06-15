---
name: update-resource-governance-structure
description: Scan the actual .resources/ folder structure and update .resources/constitution.md to reflect it exactly, then persist the change in ICM.
---

# /update-resource-governance-structure — Sync Resources Constitution

Detects the real folder structure inside `.resources/`, updates `.resources/constitution.md` to match it, and persists the change in ICM.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "resources structure constitution", topic: "{WORKSPACE}-context")
```

### Step 2: Scan Actual Structure

Scan `.resources/` recursively:

```bash
find .resources/ -not -path '*/\.*' | sort
```

Read current `.resources/constitution.md` to see what it currently declares.

### Step 3: Build the Updated Structure Declaration

From scan results, build the complete folder tree. For each folder found:
- Identify name and parent path
- Infer purpose from files inside it, or ask Owner if unclear

Produce the updated structure block:

```text
.resources/
├── constitution.md          ← This governance document
├── userstories/             ← {purpose}
├── workflows/               ← {purpose}
└── {any-other-folder}/      ← {purpose}
```

### Step 4: Update `.resources/constitution.md`

Rewrite the `## Required Structure` section to match discovered structure:
- Preserve: Authority, Semantics, Mutation Rules sections
- Replace: `## Required Structure` with the updated tree
- Add: `## Last Synchronized` section with the current date and triggering operation

### Step 5: Mirror to Scaffold

Apply the same `constitution.md` update to `scaffold/.resources/constitution.md`.

### Step 6: Persist in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Resources Constitution Synchronized\n**Operation**: /update-resource-governance-structure\n**Folders detected**: {list}\n**Constitution updated**: .resources/constitution.md\n**Scaffold synced**: yes\n**Date**: {date}",
  keywords: "resources,constitution,governance,structure-sync"
)
```

### Step 7: Confirm

> "✅ `.resources/constitution.md` updated and synchronized with the actual folder structure. ICM persisted."

Suggest running `@resource-analyst` to re-scan and internalize the updated resource layout.
