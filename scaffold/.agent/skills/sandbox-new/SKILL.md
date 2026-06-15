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
6. **Temporary execution strategy** — what must use real integrations now, and what needs isolated temporary behavior during prototyping?

### Step 3: Create Sandbox Structure

```
.sandboxes/{sandbox-name}/
├── config.md       ← Immutable post-creation
├── changelog.md    ← Version history
└── exports/        ← Snapshots
```

Write `config.md` with: Metadata (created, owner, related task, status), Purpose, Scope, Stack Constraints, Temporary Execution Strategy, Rules.

Mandatory Rules:

1. Config is immutable after creation
2. Sandbox work is exploratory
3. Export before integration
4. Frontend work must preserve a migratable chain: page or flow -> store or state boundary -> service boundary -> execution client
5. Components, pages and stores cannot contain runtime selection of temporary implementations or simulation logic
6. Temporary behavior must live in sandbox-only adapters, fixtures or explicit feature flags documented in changelog.md
7. Any artifact expected to integrate later must be removable from temporary sandbox behavior unless the Owner explicitly approves the exception

Write `changelog.md` with initial v1 entry.

### Step 4: Register + Persist

1. Update `.sandboxes/registry.md`
2. Store in ICM:
   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{SANDBOX_NAME}",
     importance: "high",
     content: "Sandbox Created: {name}\nPurpose: {purpose}\nScope: {scope}\nTemporary Execution Strategy: {temporary-execution-strategy}"
   )
   ```

### Step 5: Confirm

> "Sandbox `{name}` created. Start prototyping. Keep temporary behavior isolated from the integration path. When ready, `/sdd-verify` to validate."
