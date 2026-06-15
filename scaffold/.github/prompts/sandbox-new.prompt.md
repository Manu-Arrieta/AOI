---
description: "Create an isolated sandbox environment for prototyping. Optional workflow."
mode: "agent"
---

# /sandbox-new — Create Sandbox

Create an isolated sandbox environment for prototyping a feature before integrating it into the main codebase.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context conventions", topic: "{WORKSPACE}-context")
```

### Step 2: Gather Owner Intent

Ask the Owner for:

1. **Sandbox name** — short kebab-case identifier (e.g., `auth-flow-v2`, `dashboard-charts`)
2. **Purpose** — what are you prototyping?
3. **Scope** — which parts of the codebase does this touch?
4. **Stack constraints** — any specific libraries or patterns to use/avoid?
5. **Related TASK-ID** (optional) — if this sandbox relates to an existing task
6. **Temporary execution strategy** — what must use real integrations now, and what needs isolated temporary behavior during prototyping?

### Step 3: Create Sandbox Structure

```
.sandboxes/{sandbox-name}/
├── config.md          ← Purpose, stack, scope (immutable post-creation)
├── changelog.md       ← Version history of modifications
└── exports/           ← Exportable snapshots
```

Write `config.md`:

```markdown
# Sandbox: {sandbox-name}

## Metadata
- **Created**: {date}
- **Owner**: {user}
- **Related Task**: {TASK-ID or "None"}
- **Status**: 🟢 Active

## Purpose
{user-provided purpose}

## Scope
{user-provided scope — files/directories this sandbox touches}

## Stack Constraints
{user-provided or "Follow project constitution"}

## Service Execution Needs
{user-provided or "Prefer real service boundaries; isolate any temporary doubles outside the integration path"}

## Rules
1. This config is IMMUTABLE after creation — changes go to changelog.md
2. All sandbox work is exploratory — no guarantees of integration
3. Export before integration via `.sandboxes/{sandbox-name}/exports/`
4. Frontend work must preserve a migratable chain: page or flow -> store or state boundary -> service boundary -> execution client
5. Components, pages and stores cannot contain runtime selection of temporary implementations or simulation logic
6. Temporary behavior must live in sandbox-only adapters, fixtures or explicit feature flags documented in changelog.md
7. Any artifact expected to integrate later must be cleanly removable from temporary sandbox behavior before migration unless the Owner explicitly approves that exception
```

Write `changelog.md`:

```markdown
# Changelog — {sandbox-name}

| Version | Date | Change | Rationale |
|---------|------|--------|-----------|
| v1 | {date} | Initial creation | {purpose} |
```

### Step 4: Register + Persist

1. Update `.sandboxes/registry.md` with the new sandbox
2. Persist in ICM:
   ```
   icm_memory_store(
     topic: "sandbox-{WORKSPACE}-{SANDBOX_NAME}",
     importance: "high",
     content: "## Sandbox Created: {name}\n**Purpose**: {purpose}\n**Scope**: {scope}\n**Related Task**: {TASK-ID or None}\n**Temporary Execution Strategy**: {temporary-execution-strategy}"
   )
   ```

### Step 5: Confirm

> "Sandbox `{sandbox-name}` created. You can start prototyping. Keep temporary behavior isolated from the integration path. When ready to integrate, use `/sdd-verify` to validate."

**Create a sandbox for:**
{{input}}
