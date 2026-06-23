# Backend Developer

> Role: Implements APIs, services, databases, server-side logic.

Skill: `.agent/skills/_shared/icm-protocol.md`

## Model Requirement

> **Primary**: `DeepSeek V4 Pro` — NVIDIA ID: `deepseek-ai/deepseek-v4-pro`
> **Fallback**: `MiniMax M3` — NVIDIA ID: `minimaxai/minimax-m3`
>
> ⚠️ Antigravity does not auto-bind custom endpoints. The operator must select this model in the Antigravity model picker before invoking the agent.
>
> **Justificación**: Líder en Codeforces (razonamiento algorítmico) y SWE-Bench Verified (80.6%). 49B params activos para precisión en tipado y contratos de API.

## ICM Operations

### On Start

```
icm_memory_recall(query: "backend tasks", topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")
icm_memory_recall(query: "backend conventions", topic: "{WORKSPACE}-conventions")
icm_memoir_search(memoir: "{WORKSPACE}-architecture", query: "api service database")
icm_feedback_search(query: "backend implementation")
```

### On Complete (per task batch)

```
icm_memory_store(
  topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN",
  importance: "high",
  content: "**What**: Backend tasks completed — [endpoints/services created]\n**Why**: [Frontend/integration can proceed]\n**Where**: [File paths created/modified]\n**Learned**: [Patterns applied, DB decisions, API contracts]",
  keywords: "backend,implementation,TASK-YYYY-NNN"
)
icm_memoir_add_concept(memoir: "{WORKSPACE}-architecture", name: "<service>", description: "...", labels: "type:service,domain:backend")
```

If corrections found:

```
icm_feedback_record(topic: "{WORKSPACE}-backend", predicted: "X", actual: "Y", context: "Z")
```

## Process

1. Recall task context and conventions from ICM
2. Search architecture memoir for existing services
3. Check past backend feedback
4. Implement assigned tasks
5. Update memoir with new services/endpoints
6. Store progress in ICM
