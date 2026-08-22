---
description: "Formally close a task: consolidate ICM, generate docs, produce archive report, record transcript."
agent: "agent"
---

# /sdd-archive — Formal Closure

Formally close a completed task: consolidate memory, generate documentation, produce archive report.

## Instructions

You are the @supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall Context

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "verify report complete", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

> **Headroom mandatory policy.** Any Copilot CLI invocation in this workspace MUST be routed through `bash scripts/aoi-headroom-wrap.sh` (or the `aoi-copilot` shim) so the call exits via `headroom wrap copilot --subscription`. The wrapper refuses to run when `headroom` is missing.

### Step 2: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record all archive decisions verbatim. This captures closure rationale, what was deliberately excluded, and final decisions that would be lost in summarization.

### Step 3: Identify Task + Validate (Context-Agnostic Resolution)

Resolve the target TASK-ID automatically using the following priority order (do NOT interrupt or ask if context is available):

1. **Explicit Argument**: If `{{input}}` contains an explicit TASK-ID (e.g. `TASK-2026-001`), validate and use it.
2. **Current Conversation Context**: If a task was just verified in `/sdd-verify` within the active session, use that TASK-ID automatically.
3. **Recent Registry Inference**: If `{{input}}` is empty, "continua", "procede", "adelante", "archiva", or similar confirmation:
   - Read `.tasks/registry.md` and pick the most recent task with status `✅ Implementado`.
   - Announce briefly: `▸ Contexto auto-detectado: TASK-YYYY-NNN ({feature-name}) — Archivando y sincronizando con memoria persistente...`
4. **Fallback**: Only if multiple verified tasks exist without prior conversation context, list active tasks and ask the Owner to select one.

5. Read verify report: `.tasks/{feature-name}/TASK-YYYY-NNN/verify-report.md`
6. Confirm PASS status
7. **TDD Gate compliance**: confirm verify-report shows all implementation tasks had tests written (RED → GREEN → REFACTOR). If TDD Gate was not met, warn the Owner before proceeding.

### Step 4: Generate Documentation

Hand off to **@documentation-analyst**:

1. Read all artifacts in `.tasks/{feature-name}/TASK-YYYY-NNN/`
2. Produce `functional-docs.md` — end-user documentation, non-technical language
3. Cover: what was implemented, how to use it, edge cases, screenshots if applicable

### Step 5: ICM Consolidation

Consolidate all memories for this task:

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

Also consolidate progress sub-topic if it exists:

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN-apply-progress")
```

### Step 6: Memoir Export

Export architecture knowledge for long-term preservation:

```
icm_memoir_export(memoir: "{WORKSPACE}-architecture", format: "ai")
```

### Step 7: Feedback Review

Check if any corrections were made during this task:

```
icm_feedback_stats()
icm_feedback_search(query: "TASK-YYYY-NNN")
```

If corrections exist, summarize key learnings in the archive report.

### Step 8: Produce Archive Report

Write `.tasks/{feature-name}/TASK-YYYY-NNN/archive-report.md`:

```markdown
# Archive Report — TASK-YYYY-NNN

## Summary
{One paragraph: what was built, why, key decisions}

## Artifacts Produced
| Artifact | Path | Status |
|----------|------|--------|
| Proposal | .tasks/.../proposal.md | ✅ |
| Requirement | .tasks/.../requirement.md | ✅ |
| Spec | .tasks/.../spec.md | ✅ |
| Design | .tasks/.../design.md | ✅ |
| Tasks | .tasks/.../tasks.md | ✅ |
| Implementation Plan | .tasks/.../implementation-plan.md | ✅ |
| Verify Report | .tasks/.../verify-report.md | ✅ PASS |
| Functional Docs | .tasks/.../functional-docs.md | ✅ |
| Archive Report | .tasks/.../archive-report.md | ✅ (this file) |

## Key Decisions
- {decision 1}: {rationale}
- {decision 2}: {rationale}

## What Was Deliberately Excluded
- {item}: {reason}

## Reusable Patterns Extracted (DRY)
- {pattern}: {location} — {when to reuse}

## Principles Compliance Summary
- **SRP**: {any violations noted in verify-report? resolved?}
- **Security**: {threats identified in /sdd-new, mitigations applied}
- **Observability**: {logs/metrics/traces configured, dashboards/alerts if any}

## Services Discovered/Created
- {service path}: {what it does}

## Lessons Learned
- {learning 1}
- {learning 2}

## ICM State
- Memories: consolidated
- Memoirs: updated
- Feedback: {N} corrections applied
- Transcripts: Explore + Archive sessions recorded

## Files Modified
{list of all files created or modified during this task}
```

### Step 9: Update Registry + Close

1. Update `.tasks/registry.md`: status → `📦 Archivado`, set Closed date
2. Persist final summary in ICM:
   ```
   icm_memory_store(
     topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
     importance: "critical",
     content: "ARCHIVED: {one-line summary}. See .tasks/{feature}/TASK-YYYY-NNN/archive-report.md"
   )
   ```

**The task to archive is:**
{{input}}
