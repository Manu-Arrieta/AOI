# Sandbox New — Create Sandbox (Antigravity)

> Antigravity mirror of `.github/prompts/sandbox-new.prompt.md`. Logic is identical.

Create an isolated sandbox environment for prototyping.

## Activation

This skill activates when: "sandbox-new", "nuevo sandbox", "create sandbox", "prototipar", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
```

### Step 2: Gather Owner Intent

Ask for:
1. **Sandbox name** (kebab-case)
2. **Purpose** — what are you prototyping?
3. **Scope** — which codebase parts?
4. **Stack constraints** — libraries/patterns to use/avoid?
5. **Related TASK-ID** (optional)

### Step 3: Create Sandbox Structure

```
.sandboxes/{sandbox-name}/
├── config.md       ← Immutable post-creation
├── changelog.md    ← Version history
└── exports/        ← Snapshots
```

Write `config.md` with: Metadata (created, owner, related task, status), Purpose, Scope, Stack Constraints, Rules (immutable config, exploratory, export before integration).

Write `changelog.md` with initial v1 entry.

### Step 4: Register + Persist

1. Update `.sandboxes/registry.md`
2. Store in ICM:
   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{SANDBOX_NAME}",
     importance: "high",
     content: "Sandbox Created: {name}\nPurpose: {purpose}\nScope: {scope}"
   )
   ```

### Step 5: Confirm

> "Sandbox `{name}` created. Start prototyping. When ready, `/sdd-verify` to validate."
