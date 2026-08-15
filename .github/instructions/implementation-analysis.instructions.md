---
name: "Implementation Analysis Gate"
description: "MANDATORY analysis phase before any implementation. Agents MUST understand existing code architecture, dependencies, and data flow before writing a single line."
applyTo: "**"
---

# Implementation Analysis Gate — MANDATORY

**Fires BEFORE any implementation begins.** Complete this analysis gate before your first tool call that edits a file. Agents that jump straight to coding destroy working business logic.

---

## The 5-Step Analysis Gate (Do NOT Skip)

### Step 1: Read the target area (Surgical Discovery)
Understand before touching any file:
* **Token Guard**: Read specific line ranges or symbols — do NOT view entire large files (>300 LOC) blindly.
* What does this code actually do? (NOT what the task description assumes)
* Why was it structured this way? (patterns, architecture decisions)
* What calls into it? (callers, consumers) → use `search_graph` and `trace_path`
* What does it call? (dependencies, services, utilities)

### Step 2: Discover integration points
* Is there already a pattern, service, or utility that handles this concern?
* Where does the new code fit in the existing architecture?
* Will the new code create side effects?
* **Extend existing patterns** — do not create duplicate parallel ones.

### Step 3: Check existing tests
* Are there tests for the area you're about to change?
* What behavior do the tests expect?
* Run existing baseline tests BEFORE making changes.

### Step 4: State your understanding (Brief Output)
Output this summary before writing code:
```text
ANALYSIS COMPLETE:
- Target area: [file paths]
- What it does: [1-2 sentence summary]
- Integration points: [callers, callees, patterns]
- Blast radius: [Low / Medium / High] — (N dependent files identified)
- Existing tests: [found/none, baseline passing/failing]
- Approach: [how the new code will fit into existing architecture]
```

### Step 5: Implement with awareness (TDD)
* **TDD Gate**: Follow RED → GREEN → REFACTOR. No production code without a failing test first.
* **Keep existing tests passing**: If a test breaks, your change is wrong.
* **Run checks**: Run `get_errors` on modified files and store results in ICM.

---

## Red Flags — STOP IMMEDIATELY
* ❌ Changing shared types/interfaces without checking ALL consumers.
* ❌ Modifying public contracts, exported APIs, or composables without backward compatibility.
* ❌ Removing code that "looks unused" without verifying call chains via `search_graph`.
* ❌ Rewriting working logic to fit personal style instead of repository conventions.
* ❌ Touching code without understanding WHY it exists.
