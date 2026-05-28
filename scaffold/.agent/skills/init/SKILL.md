# Init — Project Initialization (Antigravity)

> Antigravity mirror of `.github/prompts/init.prompt.md`. Logic is identical.

Bootstrap the agentic infrastructure for a new project.

## Activation

This skill activates when: "init", "inicializar", "setup project", "bootstrap", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

Confirm: "Detected workspace: `{WORKSPACE}`. Correct?"

### Step 2: ICM Bootstrap

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "critical",
  content: "## Project: {WORKSPACE}\n**Stack**: {detected}\n**Architecture**: {TBD}\n**Conventions**: {from constitution}\n**ICM Protocol**: v3"
)
```

Create architecture memoir: `icm learn` or `icm_memoir_create(name: "{WORKSPACE}-architecture")`

### Step 3: Verify Directory Structure

Ensure these exist (create if missing):

```
.tasks/registry.md
.sandboxes/registry.md
.atl/skill-registry.md
```

### Step 4: Verify spec-kit

```bash
specify integration list
```

If none: `specify init . --ai copilot` + `specify init . --ai agy --ai-skills`

### Step 5: Verify Constitution

Check `.specify/memory/constitution.md`. Warn if missing.

### Step 6: Verify Agent Files

Check all 8 agent pairs exist (Copilot + Antigravity). Report missing.

### Step 7: Populate Skill Registry

Update `.atl/skill-registry.md` with actual `{WORKSPACE}` name.

### Step 8: Summary Checklist

```
✅ Workspace: {name}
✅ ICM: bootstrapped
✅ Memoir: created
✅ Directories: .tasks/ .sandboxes/ .atl/
✅ spec-kit: installed
✅ Constitution: {status}
✅ Agents: {N}/8
✅ Skill Registry: populated
```

→ "Ready. Start with `/sdd-new`."
