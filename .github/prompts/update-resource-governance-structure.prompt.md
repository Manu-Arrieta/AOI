---
description: "Scan the actual .resources/ folder structure and update .resources/constitution.md to reflect it exactly, then persist the change in ICM."
agent: "agent"
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

Scan `.resources/` recursively to discover every folder and file:

```bash
find .resources/ -not -path '*/\.*' | sort
```

Also read the current `.resources/constitution.md` to understand what it currently declares.

### Step 3: Build the Updated Structure Declaration

From the scan results, build the complete folder tree. For each folder found:

- Identify its name and parent path
- Infer or confirm its purpose from any existing files inside it, or ask the Owner if the purpose is unclear

Produce the updated structure block in this format:

```text
.resources/
├── constitution.md          ← This governance document
├── userstories/             ← {purpose}
├── workflows/               ← {purpose}
└── {any-other-folder}/      ← {purpose}
```

### Step 4: Update `.resources/constitution.md`

Rewrite the `## Required Structure` section to match the discovered structure. Rules:

- Preserve all sections that are still valid (Authority, Semantics, Mutation Rules)
- Only replace the `## Required Structure` section with the updated tree and folder descriptions
- Add a new `## Last Synchronized` section at the bottom with the current date and the operation that triggered the update

### Step 5: Mirror to Scaffold

If `.resources/` is part of the installed scaffold, apply the same `constitution.md` update to `scaffold/.resources/constitution.md`.

### Step 6: Persist in ICM

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "high",
  content: "## Resources Constitution Synchronized\n**Operation**: /update-resource-governance-structure\n**Folders detected**: {list}\n**Constitution updated**: .resources/constitution.md\n**Scaffold synced**: {yes|no}\n**Date**: {date}",
  keywords: "resources,constitution,governance,structure-sync"
)
```

### Step 7: Confirm

> "✅ `.resources/constitution.md` updated and synchronized with the actual folder structure. ICM persisted."

Suggest running `@resource-analyst` to re-scan and internalize the updated resource layout.

**Trigger this update for:**
{{input}}
