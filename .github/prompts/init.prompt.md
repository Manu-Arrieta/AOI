---
description: "Initialize a project's agentic infrastructure: ICM bootstrap, constitution, agents, skills, hooks, instructions, prompts, and base-project map."
agent: "agent"
---

# /init — Project Initialization

Bootstrap the complete agentic infrastructure for a new project. Verifies EVERY
customization layer (agents, skills, instructions, hooks, prompts, MCP, constitution).

## Instructions

You are the @supervisor. Execute these steps IN ORDER. Do NOT skip verification steps.

### Step 1: Detect Workspace

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

Confirm with the user: "Detected workspace: `{WORKSPACE}`. Is this correct?"

### Step 2: Detect Project Stack

Scan the project for tech stack indicators:

```bash
# Detect package manager
ls package.json pnpm-workspace.yaml pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null

# Detect languages
find . -maxdepth 3 -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" 2>/dev/null | head -20

# Detect frameworks
grep -l "nuxt\|next\|react\|vue\|angular\|svelte\|express\|fastapi\|django\|gin" package.json 2>/dev/null
```

Present findings: "Detected stack: {languages}, {frameworks}, {packageManager}."

### Step 3: ICM Bootstrap

Initialize project memory:

```
icm_memory_store(
  topic: "{WORKSPACE}-context",
  importance: "critical",
  content: "## Project: {WORKSPACE}\n**Stack**: {detected stack}\n**Architecture**: {detected or TBD}\n**Team**: {ask user}\n**Conventions**: {from constitution or TBD}\n**ICM Protocol**: v3\n**SDD Version**: scaffold-based"
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

### Step 4: Verify Directory Structure

Ensure these directories exist (create if missing):

```
.tasks/registry.md          ← Feature/task tracking
.sandboxes/registry.md      ← Sandbox environments
.resources/userstories/     ← User story artifacts
.resources/workflows/       ← Workflow definitions
```

### Step 5: Verify spec-kit Integration

```bash
specify integration list
```

If NO Copilot integration is installed:

```bash
specify init . --ai copilot --force
```

Verify the `/speckit.*` commands are available.

### Step 6: Verify ALL Agent Files (27 agents)

Check that ALL agent files exist in `.github/agents/`:

**SDD Core (10 agents):**

| Agent                  | File                                             |
| ---------------------- | ------------------------------------------------ |
| Supervisor             | `.github/agents/supervisor.agent.md`             |
| Functional Analyst     | `.github/agents/functional-analyst.agent.md`     |
| Solution Architect     | `.github/agents/solution-architect.agent.md`     |
| Integration Specialist | `.github/agents/integration-specialist.agent.md` |
| Documentation Analyst  | `.github/agents/documentation-analyst.agent.md`  |
| Triage Specialist      | `.github/agents/triage-specialist.agent.md`      |
| Resource Analyst       | `.github/agents/resource-analyst.agent.md`       |
| Project Analyzer       | `.github/agents/project-analyzer.agent.md`       |
| Project Expert         | `.github/agents/project-expert.agent.md`         |
| UX Designer            | `.github/agents/ux-designer.agent.md`            |

**Implementation (3 agents):**

| Agent              | File                                         |
| ------------------ | -------------------------------------------- |
| Frontend Developer | `.github/agents/frontend-developer.agent.md` |
| Backend Developer  | `.github/agents/backend-developer.agent.md`  |
| DevOps Engineer    | `.github/agents/devops-engineer.agent.md`    |

**Spec-Kit (9 agents):**

| Agent                 | File                                            |
| --------------------- | ----------------------------------------------- |
| speckit.constitution  | `.github/agents/speckit.constitution.agent.md`  |
| speckit.specify       | `.github/agents/speckit.specify.agent.md`       |
| speckit.clarify       | `.github/agents/speckit.clarify.agent.md`       |
| speckit.plan          | `.github/agents/speckit.plan.agent.md`          |
| speckit.tasks         | `.github/agents/speckit.tasks.agent.md`         |
| speckit.analyze       | `.github/agents/speckit.analyze.agent.md`       |
| speckit.checklist     | `.github/agents/speckit.checklist.agent.md`     |
| speckit.implement     | `.github/agents/speckit.implement.agent.md`     |
| speckit.taskstoissues | `.github/agents/speckit.taskstoissues.agent.md` |

**Spec-Kit Git (5 agents):**

| Agent                  | File                                             |
| ---------------------- | ------------------------------------------------ |
| speckit.git.initialize | `.github/agents/speckit.git.initialize.agent.md` |
| speckit.git.feature    | `.github/agents/speckit.git.feature.agent.md`    |
| speckit.git.commit     | `.github/agents/speckit.git.commit.agent.md`     |
| speckit.git.remote     | `.github/agents/speckit.git.remote.agent.md`     |
| speckit.git.validate   | `.github/agents/speckit.git.validate.agent.md`   |

Count and report: "{N}/27 agents present. Missing: {list}."

### Step 7: Verify Instructions

Check all `.github/instructions/*.instructions.md` files have valid YAML frontmatter
with `applyTo`:

| Instruction File                   | Expected `applyTo`                                     |
| ---------------------------------- | ------------------------------------------------------ |
| `agent-delegation.instructions.md` | `**`                                                   |
| `code-safety.instructions.md`      | `**/*.{ts,js,vue,py,sh,ps1,json,cs,java,go,rb,php,rs}` |
| `icm-protocol.instructions.md`     | `**`                                                   |
| `model-selection.instructions.md`  | `**`                                                   |
| `rtk.instructions.md`              | `**`                                                   |

For each file, validate: `head -7 .github/instructions/{file}` shows correct YAML.

### Step 8: Verify Skills

Check that all 5 skills exist in `.github/skills/` with valid `SKILL.md`:

| Skill                  | Directory                              | Purpose                       |
| ---------------------- | -------------------------------------- | ----------------------------- |
| `icm`                  | `.github/skills/icm/`                  | ICM protocol & memory systems |
| `rtk`                  | `.github/skills/rtk/`                  | RTK CLI usage                 |
| `sdd-lifecycle`        | `.github/skills/sdd-lifecycle/`        | SDD phases, gates, artifacts  |
| `memory-governance`    | `.github/skills/memory-governance/`    | Memory versioning & bundles   |
| `spec-kit-integration` | `.github/skills/spec-kit-integration/` | Spec-kit commands & templates |

Validate each: `head -3 .github/skills/{name}/SKILL.md` shows valid `name` + `description` in YAML frontmatter.

### Step 9: Verify Hooks

Check all hook files in `.github/hooks/`:

| Hook File                 | Expected Events                                                 |
| ------------------------- | --------------------------------------------------------------- |
| `icm.json`                | `SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit` |
| `rtk-rewrite.json`        | `PreToolUse`                                                    |
| `session-init.json`       | `SessionStart`                                                  |
| `post-tool-learning.json` | `PostToolUse`                                                   |
| `session-close.json`      | `Stop`                                                          |

Validate: each hook file is valid JSON with `hooks` object containing PascalCase event names.

### Step 10: Verify Prompts

Check that `.github/prompts/` contains all SDD workflow prompts:

| Prompt File             | Slash Command  |
| ----------------------- | -------------- |
| `init.prompt.md`        | `/init`        |
| `sdd-new.prompt.md`     | `/sdd-new`     |
| `sdd-ff.prompt.md`      | `/sdd-ff`      |
| `sdd-apply.prompt.md`   | `/sdd-apply`   |
| `sdd-verify.prompt.md`  | `/sdd-verify`  |
| `sdd-archive.prompt.md` | `/sdd-archive` |

Plus memory governance and speckit prompts. Count and report any missing.

### Step 11: Verify MCP Configuration

Check `.vscode/mcp.json`:

```
jq '.servers | keys' .vscode/mcp.json
```

Expected servers: `icm`, `codebase-memory`. Report missing servers.

### Step 12: Verify copilot-instructions.md

Check `.github/copilot-instructions.md` contains:

- `<!-- icm:start -->` / `<!-- icm:end -->` block
- MCP tool activation section

### Step 13: Verify Git Hooks

Check `.githooks/pre-commit-aoi-guard.sh` exists and is executable:

```bash
test -x .githooks/pre-commit-aoi-guard.sh && echo "OK" || echo "MISSING"
```

### Step 14: Verify Constitution

Check `.specify/memory/constitution.md` exists:

- If exists → read and summarize key principles (Scaffold Mirror Integrity, ICM-Centered, Spec-Kit Governed, RTK-First, Verification Over Drift)
- If missing → offer to generate it: "No constitution found. I can generate one based on your project's stack and conventions. Should I?"

If generated, customize for the detected stack (Step 2).

### Step 15: Propose Project-Specific Skills

Based on the detected stack (Step 2), suggest additional skills:

| If detected...             | Suggest skill                                                 |
| -------------------------- | ------------------------------------------------------------- |
| React / Next.js            | `react-patterns` — component patterns, hooks conventions      |
| Vue / Nuxt                 | `vue-patterns` — composables, Pinia, Nuxt conventions         |
| Python / FastAPI           | `python-api` — FastAPI patterns, testing with pytest          |
| Go                         | `go-services` — service patterns, error handling              |
| Monorepo (pnpm workspaces) | `monorepo-conventions` — workspace structure, shared packages |
| Docker / K8s               | `deployment-patterns` — containerization, CI/CD               |

Ask the Owner: "Would you like me to create any of these project-specific skills?"

### Step 16: Propose Project-Specific Instructions

Based on the detected stack, suggest `.instructions.md` files:

| If detected... | Suggest instruction                                                             |
| -------------- | ------------------------------------------------------------------------------- |
| TypeScript     | `applyTo: "**/*.ts"` — strict mode, no `any`, prefer interfaces over types      |
| Vue SFC        | `applyTo: "**/*.vue"` — Composition API, `<script setup>`, scoped styles        |
| React JSX      | `applyTo: "**/*.tsx"` — functional components, hooks at top, no default exports |
| Python         | `applyTo: "**/*.py"` — type hints, docstrings, pytest conventions               |
| Go             | `applyTo: "**/*.go"` — error wrapping, context propagation                      |

Ask the Owner: "Would you like me to create any of these project-specific instructions?"

### Step 17: Base-Project Map (auto-detect + Owner confirm)

The base project IS the AOI install directory (`baseRoot: "."`). Detect its
framework roots, confirm with the Owner, then write the map.

1. Run the detector:

   ```bash
   node scripts/sandbox/detect-base-project.mjs
   ```

2. PRESENT the proposed `roots` to the Owner. Ask for confirmation.

3. ONLY AFTER confirmation, write `.specify/memory/base-project.json`:

   ```json
   {
     "$schemaVersion": 1,
     "baseRoot": ".",
     "detectedAt": "<ISO timestamp>",
     "confirmedBy": "<owner>",
     "workspaceManager": "pnpm",
     "roots": { "frontend": [], "backend": [], "sharedLibs": [] }
   }
   ```

4. Refresh the `BaseProjectMap` memoir concept:

   ```
   icm_memoir_add_concept(memoir: "{WORKSPACE}-architecture", name: "BaseProjectMap", ...)
   ```

### Step 18: Summary

Present a comprehensive checklist:

```
✅ Workspace: {name}
✅ Stack: {languages} / {frameworks} / {packageManager}
✅ ICM: bootstrapped ({WORKSPACE}-context + {WORKSPACE}-architecture)
✅ Directories: .tasks/ .sandboxes/ .resources/
✅ spec-kit: Copilot integration installed
✅ Constitution: {found|generated}
✅ Agents: {N}/27 present ({missing_list})
✅ Instructions: {N}/5 with valid applyTo
✅ Skills: {N}/5 present
✅ Hooks: {N}/5 hook files valid
✅ Prompts: {N} SDD + memory + speckit prompts
✅ MCP: {servers} registered
✅ copilot-instructions.md: OK
✅ Git hooks: pre-commit-aoi-guard.sh OK
✅ Base-Project Map: {written|skipped}
📋 Project-specific skills proposed: {count}
📋 Project-specific instructions proposed: {count}
```

Suggest next action: "Project is ready. Create your first task with `/sdd-new`."

### Step 19: Populate Workspace Placeholders

Replace `{WORKSPACE}` placeholders in `copilot-instructions.md` with the actual
workspace name. Store the final context in ICM.
