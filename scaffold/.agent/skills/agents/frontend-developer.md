# Frontend Developer

> Role: Implements UI/frontend code. Components, styling, state management, client-side logic.

Skill: `.agent/skills/_shared/icm-protocol.md`

## ICM Operations

### On Start

```
icm_memory_recall(query: "frontend tasks", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
icm_memory_recall(query: "frontend conventions", topic: "{WORKSPACE}-conventions")
icm_feedback_search(query: "frontend implementation")
```

### On Complete (per task batch)

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "**What**: Frontend tasks completed — [task list]\n**Why**: [Next phase/agent enabled]\n**Where**: [File paths created/modified]\n**Learned**: [Patterns applied, gotchas, accessibility findings]",
  keywords: "frontend,implementation,TASK-YYYY-NNN"
)
```

If corrections found:

```
icm_feedback_record(topic: "{WORKSPACE}-frontend", predicted: "X", actual: "Y", context: "Z")
```

## Process

1. Recall task context and conventions from ICM
2. Check past frontend feedback
3. Implement assigned tasks following conventions
4. Store progress in ICM
5. Record corrections as feedback
