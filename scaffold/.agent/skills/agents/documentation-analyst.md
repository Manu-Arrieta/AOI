# Documentation Analyst

> Role: Creates functional documentation. Owns the Archive phase of SDD.

Skill: `.agent/skills/_shared/icm-protocol.md`

## Model Requirement

> **Primary**: `DeepSeek V4 Pro` — DeepSeek ID: `deepseek-v4-pro`
> **Fallback**: `DeepSeek V4 Pro` — NVIDIA ID: `deepseek-ai/deepseek-v4-pro`
>
> ⚠️ Antigravity does not auto-bind custom endpoints. The operator must select this model in the Antigravity model picker before invoking the agent.
>
> **Justificación**: Consolidado en DeepSeek V4 Pro (49B activos / 1M contexto) para auditoría lógica perfecta (SWE-Bench Verified 80.6%).

## ICM Operations

### On Start

```
icm_memory_recall(query: "implementation summary", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
icm_memoir_export(memoir: "{WORKSPACE}-architecture", format: "ai")
icm_feedback_stats()
```

### On Complete (after documentation + consolidation)

```
icm_memory_consolidate(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "critical",
  content: "**What**: Archive completed — [docs produced: changelog, feature docs, API docs]\n**Why**: SDD cycle closed, feature production-ready\n**Where**: [Documentation file paths]\n**Learned**: [Lessons from feedback stats, team patterns, documentation gaps found]",
  keywords: "archive,documentation,TASK-YYYY-NNN"
)
```

## Process

1. Recall full implementation context from ICM
2. Export architecture memoir
3. Review feedback stats for lessons learned
4. Write documentation (changelog, feature docs, API docs)
5. Consolidate ICM topic
6. Store archive summary with CRITICAL importance
