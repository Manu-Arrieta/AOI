---
description: "Initialize a project's agentic infrastructure: ICM bootstrap, constitution, directories, skill registry."
mode: "agent"
---

# /init — Project Initialization

Bootstrap the agentic infrastructure for a new project.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

Confirm with the user: "Detected workspace: `{WORKSPACE}`. Is this correct?"

### Step 2: ICM Bootstrap

Initialize project memory:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "critical",
  content: "## Project: {WORKSPACE}\n**Stack**: {detected or user-provided}\n**Architecture**: {detected or TBD}\n**Team**: {ask user}\n**Conventions**: {detected from constitution or TBD}\n**ICM Protocol**: v3\n**SDD Version**: scaffold-based"
)
```

Create the architecture memoir:

```
icm learn
```

Or via MCP:

```
icm_memoir_create(name: "{WORKSPACE}-architecture", description: "Architecture knowledge graph for {WORKSPACE}")
```

### Step 3: Verify Directory Structure

Ensure these directories exist (create if missing):

```
.tasks/              ← Task registry + feature directories
.tasks/registry.md   ← Feature/task tracking
.sandboxes/          ← Optional sandbox environments
.sandboxes/registry.md
.atl/                ← Agent/skill discovery index
.atl/skill-registry.md
```

### Step 4: Verify spec-kit Integration

```bash
specify integration list
```

If NO integration is installed:

```bash
specify init . --ai copilot
specify init . --ai agy --ai-skills
```

Verify the `/speckit.*` commands are available.

### Step 5: Verify Constitution

Check `.specify/memory/constitution.md` exists:

- If exists → read and summarize key constraints
- If missing → warn: "No constitution found. Run `specify constitution init` or create `.specify/memory/constitution.md` manually."

### Step 6: Verify Agent Files

Check that all required agent files exist in both tools:

| Agent                  | Copilot                                          | Antigravity                                      |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Supervisor             | `.github/agents/supervisor.agent.md`             | `.agent/skills/agents/supervisor.md`             |
| Functional Analyst     | `.github/agents/functional-analyst.agent.md`     | `.agent/skills/agents/functional-analyst.md`     |
| Solution Architect     | `.github/agents/solution-architect.agent.md`     | `.agent/skills/agents/solution-architect.md`     |
| Frontend Developer     | `.github/agents/frontend-developer.agent.md`     | `.agent/skills/agents/frontend-developer.md`     |
| UX Designer            | `.github/agents/ux-designer.agent.md`            | `.agent/skills/agents/ux-designer.md`            |
| Documentation Analyst  | `.github/agents/documentation-analyst.agent.md`  | `.agent/skills/agents/documentation-analyst.md`  |
| Integration Specialist | `.github/agents/integration-specialist.agent.md` | `.agent/skills/agents/integration-specialist.md` |
| Project Expert         | `.github/agents/project-expert.agent.md`         | `.agent/skills/agents/project-expert.md`         |

Report any missing agents.

### Step 7: Populate Skill Registry

Read `.atl/skill-registry.md` and update the `{WORKSPACE}` placeholders with the actual workspace name.

### Step 8: Base-Project Map (auto-detect + Owner confirm)

The base project IS the AOI install directory (`baseRoot: "."`). Detect its
framework roots, confirm with the Owner, then write the map.

1. Run the detector to propose `roots` (it only prints a proposal — it never writes):

   ```bash
   node scripts/sandbox/detect-base-project.mjs
   ```

2. PRESENT the proposed `roots` (`frontend`, `backend`, `sharedLibs`) to the Owner
   verbatim. Ask: "Are these base-project roots correct, or do you want to
   add/remove/correct any path?"

3. WAIT for the Owner to confirm or correct. Do NOT proceed on assumption.

4. ONLY AFTER confirmation, write `.specify/memory/base-project.json` using the
   confirmed roots and set `confirmedBy` to the Owner's identity (e.g. the
   `{WORKSPACE}` user). Shape:

   ```json
   {
     "$schemaVersion": 1,
     "baseRoot": ".",
     "detectedAt": "<ISO timestamp from the detector>",
     "confirmedBy": "<owner>",
     "workspaceManager": "pnpm",
     "roots": { "frontend": [], "backend": [], "sharedLibs": [] }
   }
   ```

   `confirmedBy` MUST stay unset/null until the Owner confirms. Never write the
   file from the raw detector output without confirmation.

5. Refresh the `BaseProjectMap` memoir concept so downstream agents resolve
   integration targets against it:

   ```
   icm memoir add-concept -m "{WORKSPACE}-architecture" -n "BaseProjectMap" \
     -d "Base-project roots (.specify/memory/base-project.json): frontend=<...>, backend=<...>, sharedLibs=<...>; baseRoot=. ; confirmedBy=<owner>" \
     -l "type:map,domain:integration"
   ```

   (Use `icm_memoir_add_concept` / `icm_memoir_refine` when MCP tools are available.)

### Step 9: Summary

Present a checklist:

```
✅ Workspace: {name}
✅ ICM: bootstrapped with {WORKSPACE}-context
✅ Memoir: {WORKSPACE}-architecture created
✅ Directories: .tasks/ .sandboxes/ .atl/
✅ spec-kit: integration installed ({copilot|agy|both})
✅ Constitution: {found|missing}
✅ Agents: {N}/8 present
✅ Skill Registry: populated
✅ Base-Project Map: {written after Owner confirm | skipped}
✅ Configuration Snapshot: {synced | created | skipped}
```

### Step 10: Sync Configuration Snapshot (.conf/)

If `.conf/manifest.json` exists (created by `setup.sh`), verify that any changes made during `/init` are reflected in the snapshot:

1. **Constitution changed**: If constitution was modified/created during init:
   ```bash
   # Update constitution snapshot
   cp .specify/memory/constitution.md .conf/snapshots/constitutions/memory-constitution.md 2>/dev/null || true
   cp .resources/constitution.md .conf/snapshots/constitutions/resources-constitution.md 2>/dev/null || true
   ```

2. **Update checksum** for changed files using `shasum -a 256`

3. **Append to history**:
   ```jsonl
   {"action":"init_sync","at":"<ISO>","files_synced":["list of changed files"]}
   ```

4. If `.conf/` does NOT exist, warn: "Configuration snapshot missing. Run `setup.sh` to generate it."

Suggest next action: "Project is ready. Create your first task with `/sdd-new`."
