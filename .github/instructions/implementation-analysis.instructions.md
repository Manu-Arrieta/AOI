---
name: "Implementation Analysis Gate"
description: "MANDATORY analysis phase before any implementation. Agents MUST understand existing code architecture, dependencies, and data flow before writing a single line."
applyTo: "**"
---

# Implementation Analysis Gate — MANDATORY

**This instruction fires BEFORE any implementation begins.** When you are assigned a task that involves writing or modifying code, you MUST complete the analysis gate before your first tool call that edits a file.

## Why This Exists

Agents that jump straight to coding destroy working business logic. The codebase has patterns, contracts, and assumptions that are not obvious from a task description. You MUST discover them before you act.

## The Gate — 5 Steps (do NOT skip)

### Step 1: Read the target area

Before touching ANY file, read the files in the target area and understand:

```text
What does this code actually do? (NOT what the task description assumes)
Why was it structured this way? (patterns, architecture decisions)
What else calls into it? (callers, consumers, dependents)
What does it call? (dependencies, services, utilities)
```

Use these tools:

- `search_graph` — find symbols, functions, classes by name or pattern
- `trace_path` — follow call chains inbound and outbound
- `read_file` — read the actual source code, not summaries

### Step 2: Discover integration points

Before adding anything new:

```text
Is there already a pattern, service, or utility that handles this concern?
Where does the new code fit in the existing architecture?
Will the new code create side effects in other parts of the system?
```

Use `search_graph` with the concept name and related terms. If you find existing patterns, **extend them** — do not create parallel ones.

### Step 3: Check existing tests

```text
Are there tests for the area you're about to change?
What behavior do the tests expect?
Will your change break any existing assertions?
```

Read test files in the target area. If tests exist, run them BEFORE making changes to establish a baseline.

### Step 4: State your understanding

Before writing any code, output a brief analysis:

```text
ANALYSIS COMPLETE:
- Target area: [file paths]
- What it does: [1-2 sentence summary]
- Integration points: [callers, callees, patterns]
- Existing tests: [found/none, baseline passing/failing]
- Approach: [how the new code will fit]
```

This forces you to process what you read. It also gives the Owner transparency.

### Step 5: Implement with awareness

Only NOW do you write code. While implementing:

- **Fit into existing patterns** — don't introduce new patterns unless the task explicitly requires it
- **Keep existing tests passing** — if a test breaks, your change is wrong
- **Add tests for new behavior** — the Owner can't review what they can't verify
- **Store in ICM** — record what you changed and why

## After Implementation

1. Run ALL tests in the target area, not just the ones you wrote
2. Run `get_errors` on all modified files
3. Store a checkpoint in ICM with what changed and what you learned
4. If something surprised you during implementation, record it as feedback

## Red Flags — STOP IMMEDIATELY

- You find code that "looks wrong" or "nobody uses" — it probably has a reason
- You're about to change a shared type, interface, or contract — check ALL consumers first
- The existing pattern doesn't match your preferred style — follow the existing pattern anyway
- Tests don't exist for the area you're changing — be EXTRA careful, you have no safety net
- You don't understand WHY something exists — don't touch it until you do

## Remember

> The code you're about to change is working business logic. Your job is to understand it first, extend it second. Analysis is not optional — it's the gate you must pass before any implementation tool call.
