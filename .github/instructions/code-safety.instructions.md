---
name: "Code Safety Protocol"
description: "Prevents destruction of existing business logic. Agents must understand context before making changes and verify nothing is broken."
applyTo: "**/*.{ts,js,vue,py,sh,ps1,json,cs,java,go,rb,php,rs}"
---

# Code Safety Protocol — MANDATORY

This infrastructure is for **software development**. The codebase contains business logic that works. Your changes MUST NOT break it.

## Before Making ANY Change

1. **Read and understand** the existing code in the target area:
   - What does this code do?
   - Why was it written this way?
   - What else depends on it?

2. **Check the constitution**: read `.specify/memory/constitution.md` for project constraints.

3. **Verify integration points**:
   - Use `search_graph` or `grep` to find all callers/consumers
   - Use `trace_path` to understand data flow
   - Check test files for expected behavior

## When Adding New Code

1. **Fit, don't force**: the new solution must integrate with existing patterns, not fight them.
2. **Don't duplicate**: check if there's already a pattern, utility, or service that handles this.
3. **Extend, don't replace**: prefer adding new capabilities alongside existing ones over rewriting working code.

## After Making Changes

1. **Run existing tests**: `pnpm test` or project-specific test command.
2. **Verify no regressions**: if tests fail, the change is wrong — fix it, don't skip tests.
3. **Check type errors**: run `get_errors` on modified files.
4. **Store in ICM**: record what changed and why.

## Red Flags — STOP if you see

- A function/method that "nobody uses" — check with `search_graph` first
- Code that "looks wrong" but has no tests — it may be intentional
- "Clean up" or "remove unused" without understanding the full call chain
- Changing a shared type/interface/contract without checking ALL consumers

## Remember

> The working business logic is the source of truth. Your job is to extend it, not replace it. If you don't understand why something exists, investigate before touching it.
