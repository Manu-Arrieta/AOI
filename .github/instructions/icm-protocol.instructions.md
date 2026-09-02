---
applyTo: "**"
---

# ICM Protocol — 5-Method Memory Compliance (v4)

**MANDATORY FOR ALL AGENTS**: You MUST use ICM (Infinite Context Memory) throughout ALL work. ICM has five distinct memory systems; each serves a specific operational purpose and ALL FIVE must be utilized during the SDD lifecycle.

---

## 1. Workspace Isolation & Detection

ICM operates on a shared global database. To prevent memory bleed across projects, **ALL topics, memoirs, feedback topics, and fact entities MUST be prefixed with `{WORKSPACE}`**.

```bash
# Priority: git remote basename > directory basename
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

### Canonical Naming Conventions

* `{WORKSPACE}-context` — Project-wide context (stack, architecture baseline, team constraints).
* `sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN` — Isolated per-task context for SDD lifecycle.
* `{WORKSPACE}-architecture` — Structural decisions, component boundaries.
* `{WORKSPACE}-conventions` — Coding patterns, linting, styling standards.
* `{WORKSPACE}-errors-resolved` — Root cause analysis and fixes for past bugs.
* `{WORKSPACE}-services-catalog` — Discovered composables, services, and endpoints (informational).
* `{WORKSPACE}.{subsystem}.{key}` — Structured exact facts (e.g. `{WORKSPACE}.service.auth = /api/v1/auth`).
* `{WORKSPACE}-session-summaries` — End-of-session milestones.
* `sandbox-{WORKSPACE}-{SANDBOX_NAME}` — Sandbox-specific state and context.

---

## 2. The 5 Memory Systems & MCP Tool Activation

### Mandatory MCP Activation & Auto-Reactivation Invariant
At the start of every session (and whenever any tool appears disabled), activate all MCP tool groups:
```
activate_knowledge_graph_management_tools
activate_long_term_memory_management_tools
activate_project_management_tools
activate_feedback_management_tools
activate_transcript_management_tools
activate_memory_consolidation_tools
activate_code_analysis_and_search_tools
```
If an ICM or Codebase MCP tool is reported as disabled or missing during execution, **immediately run its corresponding `activate_*` tool** before proceeding.

| Method | System Type | Purpose & Lifecycle | Primary MCP / CLI Tools | CLI Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **1. Memories** | Episodic | Temporal facts with decay & auto-dedup (>85%) | `icm_memory_store`, `icm_memory_recall`, `icm_memory_update`, `icm_memory_forget`, `icm_memory_consolidate`, `icm_memory_list_topics`, `icm_memory_stats`, `icm_memory_health` | `icm store -t "{TOPIC}" -c "..." -i high` / `icm recall` |
| **2. Memoirs** | Knowledge Graph | Permanent structured concepts & typed relation graph | `icm_memoir_create`, `icm_memoir_list`, `icm_memoir_show`, `icm_memoir_add_concept`, `icm_memoir_refine`, `icm_memoir_search`, `icm_memoir_search_all`, `icm_memoir_link`, `icm_memoir_inspect`, `icm_memoir_export` | `icm memoir add-concept -m "{WORKSPACE}-architecture"` |
| **3. Facts** | Structured Exact | Deterministic (entity, key, value) triples with supersession history | `icm facts set`, `icm facts get`, `icm facts list`, `icm facts history` | `icm facts set "{WORKSPACE}" "service.name" "endpoint"` |
| **4. Feedback** | Self-Correction | Past mistake corrections & assumptions | `icm_feedback_record`, `icm_feedback_search`, `icm_feedback_stats` | `icm feedback record -t "{WORKSPACE}-{category}"` |
| **5. Transcripts** | Verbatim Logs | Raw prompt & response session capture & replay | `icm_transcript_start_session`, `icm_transcript_record`, `icm_transcript_end_session`, `icm_transcript_search`, `icm_transcript_get_session` | `icm transcript record` |

---

## 3. Structured Facts Protocol (`icm facts`)

Use `icm facts` for deterministic, non-fuzzy operational data to eliminate LLM configuration hallucination:
* **Endpoints & Routes**: `icm facts set "{WORKSPACE}" "endpoint.{name}" "{path}"`
* **Ports & Services**: `icm facts set "{WORKSPACE}" "service.{name}.port" "{port}"`
* **Package/Dependency Versions**: `icm facts set "{WORKSPACE}" "dependency.{name}" "{version}"`
* **Feature Flags**: `icm facts set "{WORKSPACE}" "feature.{flag}" "{state}"`

When a fact changes, `icm facts set` automatically archives the previous value under `superseded_at` while keeping active lookups O(1) exact.

---

## 4. Memoirs: Typed Graph Relations & Knowledge Distillation

### Canonical Typed Relations
When linking concepts in Memoirs (`icm_memoir_link`), you MUST use one of the canonical typed relations:
`part_of` · `depends_on` · `related_to` · `contradicts` · `refines` · `alternative_to` · `caused_by` · `instance_of` · `superseded_by`

### Distillation on Task Closure
During `/sdd-archive`, run automatic knowledge distillation before consolidating episodic topics:
```bash
icm extract-patterns -t "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN" -m "{WORKSPACE}-architecture"
icm memoir distill -t "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN" -m "{WORKSPACE}-architecture"
```

---

## 5. Instant Wake-Up Briefings

To achieve zero-latency agent startup without multi-turn context queries:
1. **Regenerate Briefing** upon task completion/archive:
   ```bash
   icm briefing --project "$WORKSPACE"
   ```
2. **Instant Recall** on new session start:
   ```bash
   icm wake-up
   ```

---

## 6. Sandbox Isolation & Read-Only Policy

When operating in experimental sandboxes (`.sandboxes/{name}/`) or automated benchmark runners:
* Set `export ICM_READONLY=1` or pass `--read-only` to all ICM read commands.
* If sandbox-local state must be written, isolate it under the dedicated topic prefix `sandbox-{WORKSPACE}-{name}`. Never mutate core `{WORKSPACE}-*` topics or facts from an unmerged sandbox.

---

## 7. Importance Policy & Lifecycle Rules

| Importance | Decay Rate | Auto-prune | Mandatory Usage Scenarios |
| :--- | :--- | :--- | :--- |
| `critical` | **NONE** | Never | Project context, stack, architecture decisions, conventions, user preferences |
| `high` | Slow | Never | Specs, plans, completed tasks, design decisions, QA reports, resolved errors |
| `medium` | Normal | Yes | Implementation progress, batch checkpoints (3-5 tasks completed) |
| `low` | Fast | Yes | Exploration scratchpad notes, temporary ideas |

* **Auto-Dedup**: Storing content with >85% similarity in the same topic **automatically updates** the existing record.
* **Consolidation**: When a topic exceeds 7 entries, run `icm_memory_consolidate(topic)` immediately.
* **Prompt Recall**: Use `icm recall-context "query" -t "{TOPIC}" --limit 3` for compact prompt injection.
* **What NOT to Store**: Raw build/test output logs, transient git status, or ephemeral scratch.

---

## 8. Phase-by-Phase Operational Action Triggers

| Event / Phase Boundary | Tool Invocation | CLI Fallback | Importance / Mode |
| :--- | :--- | :--- | :--- |
| **Session Start** | `icm wake-up` / `icm_memory_recall` | `icm wake-up` | — |
| **Task Start** | `icm_memory_recall(query, topic: "sdd-{WS}-{FEAT}-TASK-YYYY-NNN")` | `icm recall "query" -t "topic"` | — |
| **Project Stack / Context** | `icm_memory_store(topic, content, importance: "critical")` | `icm store -t topic -c "..." -i critical` | `critical` |
| **Deterministic Config/Port** | `icm facts set "{WS}" "key" "value"` | `icm facts set "{WS}" "key" "value"` | Exact Fact |
| **Architecture Decision** | `icm_memory_store(topic, content, importance: "critical")` | `icm store -t topic -c "..." -i critical` | `critical` |
| **Convention Established** | `icm_memory_store(topic, content, importance: "critical")` | `icm store -t topic -c "..." -i critical` | `critical` |
| **User Preference Found** | `icm_memory_store("preferences", content, importance: "critical")` | `icm store -t preferences -c "..." -i critical` | `critical` |
| **Spec / Plan Produced** | `icm_memory_store(topic, content, importance: "high")` | `icm store -t topic -c "..." -i high` | `high` |
| **Task Completed** | `icm_memory_store(topic, content, importance: "high")` | `icm store -t topic -c "..." -i high` | `high` |
| **QA / Verify Report** | `icm_memory_store(topic, content, importance: "high")` | `icm store -t topic -c "..." -i high` | `high` |
| **Error Resolved** | `icm_memory_store("errors-resolved", content, importance: "high")` | `icm store -t errors-resolved -c "..." -i high` | `high` |
| **Task Archive Closure** | `icm extract-patterns` + `icm memoir distill` | `icm memoir distill -t topic -m arch` | Permanent Graph |
| **Post-Archive Briefing** | `icm briefing --project "$WORKSPACE"` | `icm briefing -p "$WORKSPACE"` | Cached Briefing |
| **Batch Progress (3-5 tasks)**| `icm_memory_store(topic, content, importance: "medium")` | `icm store -t topic -c "..." -i medium` | `medium` |
| **Topic >7 entries** | `icm_memory_consolidate(topic)` | `icm consolidate topic` | — |

---

## 9. Version-Aware Operational Resolution

When operating in a versioned-memory workspace (pointer at `.specify/memory/versions/active.json`):
1. Resolve active version before operational mutations using `node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"`.
2. Treat canonical topics (`{WORKSPACE}-context`, `{WORKSPACE}-architecture`) as logical topics governed by the resolved version manifest.
3. Sync/import operations require explicit `sourceWorkspace` and `sourceVersionId`.
4. Rollback operations require explicit `targetVersionId` and reason.
5. Mutate `active.json` and version manifests ONLY via managed lifecycle scripts in `scripts/memory-sync/`.
