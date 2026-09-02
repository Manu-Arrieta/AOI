---
name: icm
description: Infinite Context Memory (ICM) protocol — store, recall, memoir graph, feedback, and transcripts across agent sessions. Use when the task involves remembering context, decisions, errors, or project knowledge across sessions.
---

# ICM — Infinite Context Memory Protocol

You MUST use ICM (Infinite Context Memory) throughout ALL work. ICM has four memory systems. Each one serves a different purpose and ALL FOUR must be used.

## Session Start — MANDATORY

Before writing code or answering questions, recall context:

```
icm_memory_recall(query: "project context", topic: "{WORKSPACE}-context")
icm_memory_recall(query: "pending tasks", topic: "sdd-{WORKSPACE}")
```

Activate MCP tool groups:

```
activate_knowledge_graph_management_tools
activate_long_term_memory_management_tools
activate_project_management_tools
activate_feedback_management_tools
activate_transcript_management_tools
activate_memory_consolidation_tools
activate_code_analysis_and_search_tools
```

## Store Triggers — MANDATORY

Store IMMEDIATELY when:

1. Error resolved → `icm_memory_store(topic: "{WORKSPACE}-errors-resolved", content: "...", importance: "high")`
2. Architecture decision → `icm_memory_store(topic: "{WORKSPACE}-context", content: "...", importance: "critical")`
3. User preference discovered → `icm_memory_store(topic: "{WORKSPACE}-preferences", content: "...", importance: "critical")`
4. Task completed → `icm_memory_store(topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN", content: "...", importance: "high")`
5. 20+ tool calls without store → store progress summary

## Four Memory Systems

| System      | Tool                     | Persistence | Use for                               |
| ----------- | ------------------------ | ----------- | ------------------------------------- |
| Memories    | `icm_memory_store`       | Decays      | Decisions, progress, context          |
| Memoirs     | `icm_memoir_add_concept` | Permanent   | Architecture, component relationships |
| Feedback    | `icm_feedback_record`    | Permanent   | Learning from mistakes                |
| Transcripts | `icm_transcript_record`  | Permanent   | Explore & Archive phases only         |

## Importance Policy

| Level    | Decay  | Auto-prune | Use for                              |
| -------- | ------ | ---------- | ------------------------------------ |
| critical | NONE   | never      | Project context, stack, architecture |
| high     | slow   | never      | Specs, plans, completed tasks        |
| medium   | normal | yes        | Progress checkpoints                 |
| low      | fast   | yes        | Experimental ideas                   |

## Recovery

If MCP tools are not available, use CLI fallback:

```bash
icm recall "query" -t "{WORKSPACE}-context"
icm store -t "{WORKSPACE}-context" -c "..." -i high
```
