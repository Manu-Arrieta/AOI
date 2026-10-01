---
description: "Change which model serves each agent: one for all, per category, or per agent. The only way the assignment changes after setup."
agent: supervisor
---

# /aoi-providers — Reassign Models to Agents

The assignment is chosen during setup and changes **only here**, at the Owner's request.
Nothing else writes `assignment.*`: no cycle, no re-probe, no default.

Resolution, most specific first: `agent` → `category` → `all`. An agent with none is
**unassigned** and must not be delegated to.

Run every command from the workspace root and **do not pass `--workspace`**: the scripts
use the directory name, which is the entity `setup.sh` wrote to. Deriving it from the git
remote can name a different entity and read an empty assignment.

## Step 1: Show what exists

```bash
node scripts/multi-harness/provider-setup.mjs --show
node scripts/multi-harness/provider-setup.mjs --list-models
```

If `--list-models` finds no providers, stop: tell the Owner to add them in VS Code
(`Chat: Manage Models → Add Provider`) and run this command again.

## Step 2: Ask the Owner

Show both outputs and ask exactly what to change. Scopes:

| Scope | Meaning |
| :--- | :--- |
| `all` | every agent without a more specific value |
| `category:Razonamiento` · `category:Implementación` | every agent of that category |
| `agent:<name>` | one agent |

Do not choose for the Owner. If the answer is ambiguous, ask again.

## Step 3: Probe the chosen models (optional, recommended)

For each **distinct model** the Owner chose, one trivial `runSubagent` with that `model`
value and **no `agentName`** (agent files run their Session Start block even when told
not to). Probe per model, not per provider: `Access to model denied` and
`Requested model not found` are per model.

Report each result. If one fails, tell the Owner and ask whether to keep it anyway.

## Step 4: Write

```bash
node scripts/multi-harness/provider-setup.mjs --set all=#1 --set agent:ux-designer=#3
node scripts/multi-harness/provider-setup.mjs --unset agent:ux-designer
node scripts/multi-harness/provider-setup.mjs --reset --set all=#2   # start over
```

A value is `#n` from `--list-models` or its exact text. The script refuses any value not
configured on this machine. It prints the resulting table: show it to the Owner.

## Step 5: Verify

```bash
pnpm aoi:providers
```

It must report no `ASIGNACIÓN MUERTA`.
