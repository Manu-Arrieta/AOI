# SDD Archive — Formal Closure (Antigravity)

> Antigravity mirror of `.github/prompts/sdd-archive.prompt.md`. Logic is identical.

Formally close a completed task: consolidate memory, generate docs, produce archive report.

## Activation

This skill activates when: "sdd-archive", "archivar", "archive", "cerrar tarea", or similar.

## Instructions

You are the Supervisor. Execute these steps IN ORDER.

### Step 1: Detect Workspace + Recall

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

```
icm_memory_recall(query: "context", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "verify report", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
```

### Step 2: Start Transcript (Verbatim)

```
icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")
```

Record all archive decisions verbatim — closure rationale, exclusions, final decisions.

### Step 3: Identify Task + Validate

1. Validate status `✅ Implementado` in `.tasks/registry.md`
2. Read verify-report.md, confirm PASS

### Step 4: Generate Documentation

Documentation Analyst:
1. Read all artifacts
2. Produce `functional-docs.md` — end-user docs, non-technical

### Step 5: ICM Consolidation

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN-apply-progress")
```

### Step 6: Memoir Export

```
icm_memoir_export(memoir: "{WORKSPACE}-architecture", format: "ai")
```

### Step 7: Feedback Review

```
icm_feedback_stats()
icm_feedback_search(query: "TASK-YYYY-NNN")
```

### Step 8: Produce Archive Report

Write `.tasks/{feature-name}/TASK-YYYY-NNN/archive-report.md` with: Summary, Artifacts table, Key Decisions, Exclusions, Services, Lessons, ICM State, Files Modified.

### Step 9: Update Registry + Close

1. `.tasks/registry.md` → `📦 Archivado`, set Closed date
2. Persist:
   ```
   icm_memory_store(
     topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
     importance: "critical",
     content: "ARCHIVED: {summary}. See archive-report.md"
   )
   ```
