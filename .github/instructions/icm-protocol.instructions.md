---
applyTo: "**"
---

# ICM Protocol — 4-Method Memory Compliance (v3)

You MUST use ICM (Infinite Context Memory) throughout ALL work. ICM has four memory systems. Each one serves a different purpose and ALL FOUR must be used during the SDD lifecycle.

## How to Use ICM

### Mode 1 — MCP Tools (MANDATORY, primary)

ICM exposes 27 MCP tools. These are ALWAYS available (configured by `setup.sh`). Use them directly:

```
icm_memory_store(...)       ← MANDATORY
icm_memory_recall(...)      ← MANDATORY
icm_memoir_add_concept(...) ← MANDATORY
icm_feedback_record(...)    ← MANDATORY
```

### Mode 2 — CLI Fallback (when MCP tools are absent)

If MCP tools are NOT in your tool list, use `icm` from PATH:

```bash
icm store -t "{WORKSPACE}-context" -c "..." -i critical -k "key1,key2"
icm recall "query" -t "{WORKSPACE}-context"
icm memoir add-concept -m "{WORKSPACE}-architecture" -n "name" -d "def"
icm feedback record -t "sdd-{WORKSPACE}" --predicted "X" --corrected "Y" --context "Z"
```

Do **NOT** hardcode OS-specific absolute paths such as `/opt/homebrew/bin/icm`.
**NEVER offer to install ICM manually** — it is pre-installed by project setup.

### CLI Shortcuts (project-aware, auto-detect `{WORKSPACE}`)

```bash
icm recall-project          # recall all context for current project
icm save-project "summary"  # store under {WORKSPACE}-context
icm wake-up                 # critical-facts pack for prompt injection
icm learn                   # scan project → auto-generate Memoir graph
```

## Auto-Extraction Hooks (zero LLM cost)

ICM hooks run automatically in supported tools. You do NOT need to call them — they work behind the scenes:

| Hook               | What it does                                                 | Tools                              |
| ------------------ | ------------------------------------------------------------ | ---------------------------------- |
| `SessionStart`     | Injects wake-up pack of critical/high memories (~500 tokens) | Copilot CLI, Codex, Claude |
| `PreToolUse`       | Auto-allows `icm` CLI commands (no permission prompt)        | Copilot CLI, Codex, Claude |
| `PostToolUse`      | Extracts facts from tool output every N calls (rule-based)   | Copilot CLI, Codex, Claude |
| `PreCompact`       | Extracts memories from transcript before context compression | Claude                    |
| `UserPromptSubmit` | Injects recalled context at the start of each user prompt    | Copilot CLI, Codex, Claude |

**Important**: Hooks handle automatic recall/extraction. You STILL must explicitly store important decisions, architecture changes, and phase completions — hooks only capture incidental facts.

## Method 1: Memories (Episodic)

Temporal memories with importance-based decay. Use for decisions, progress, context.

### MCP Tools

| Tool                     | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `icm_memory_store`       | Store with auto-dedup (>85% similarity → update instead of duplicate) |
| `icm_memory_recall`      | Search by query, filter by topic and/or keyword                       |
| `icm_memory_update`      | Edit a memory in-place (content, importance, keywords)                |
| `icm_memory_forget`      | Delete a memory by ID                                                 |
| `icm_memory_consolidate` | Merge all memories of a topic into one summary                        |
| `icm_memory_list_topics` | List all topics with counts                                           |
| `icm_memory_stats`       | Global memory statistics                                              |
| `icm_memory_health`      | Per-topic hygiene audit (staleness, consolidation needs)              |
| `icm_memory_embed_all`   | Backfill embeddings for vector search                                 |

### Importance Policy (MANDATORY)

ICM uses a **global** database. Decay runs across ALL projects on every recall. Incorrect importance = memory loss. Follow this table strictly:

| Importance | Decay    | Auto-prune | Use for                                                           |
| ---------- | -------- | ---------- | ----------------------------------------------------------------- |
| `critical` | **NONE** | never      | Project context, stack, team, architecture decisions, conventions |
| `high`     | slow     | never      | Specs, plans, completed tasks, design decisions, QA reports       |
| `medium`   | normal   | yes        | Implementation progress, batch checkpoints, intermediate notes    |
| `low`      | fast     | yes        | Experimental ideas, temporary notes, exploration results          |

**Rule**: When in doubt, use `high`. A `medium` memory on an inactive project WILL decay and MAY be pruned. Only use `medium` for things you're OK losing after weeks of inactivity.

### Auto-Dedup

Storing content >85% similar to an existing memory in the same topic **automatically updates** the existing memory instead of creating a duplicate. You do NOT need to check for duplicates manually.

### Consolidation Hints

When a topic exceeds 7 entries, `icm_memory_store` warns the caller to consolidate. When you see this warning, run `icm_memory_consolidate(topic)` immediately.

### Store/Recall Actions

| When                            | Action                                                                       | Importance |
| ------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| Starting any task               | `icm_memory_recall(query, topic: "sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN")` | —          |
| Project context/stack           | `icm_memory_store(topic, content, importance: "critical")`                   | critical   |
| Architecture decision           | `icm_memory_store(topic, content, importance: "critical")`                   | critical   |
| Convention established          | `icm_memory_store(topic, content, importance: "critical")`                   | critical   |
| Decision made                   | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| Spec/Plan completed             | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| Task completed                  | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| QA/Verify report                | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| Design decision (UX)            | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| Error resolved (root cause)     | `icm_memory_store(topic, content, importance: "high")`                       | high       |
| Progress checkpoint (3-5 tasks) | `icm_memory_store(topic, content, importance: "medium")`                     | medium     |
| Impl batch progress             | `icm_memory_store(topic, content, importance: "medium")`                     | medium     |
| Exploration notes               | `icm_memory_store(topic, content, importance: "low")`                        | low        |
| Topic has 7+ entries            | `icm_memory_consolidate(topic)`                                              | —          |

### What NOT to Store

- Build/test output (ephemeral)
- Git status (changes every minute)
- Content already in project files (`.specify/`, `AGENTS.md`, etc.)
- Trivial exploration that leads nowhere

## Project Isolation

ICM uses a SINGLE global database. To prevent memory bleed between projects, ALL topics and memoirs MUST be prefixed with the **workspace name** (auto-detected from the root directory basename or `git remote`).

Use `{WORKSPACE}` as the workspace identifier (e.g., `my-app`, `portal-clientes`).

### How to detect `{WORKSPACE}`

```bash
# Priority: git remote basename > directory basename
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

### Topic naming convention

- `{WORKSPACE}-context` — project-wide context (stack, team, constraints)
- `sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN` — per-task context within a feature
- `{WORKSPACE}-architecture` — structural decisions
- `{WORKSPACE}-conventions` — patterns and code standards
- `{WORKSPACE}-errors-resolved` — things learned from mistakes
- `{WORKSPACE}-services-catalog` — discovered services/composables/endpoints
- `{WORKSPACE}-session-summaries` — end-of-session summaries
- `sandbox-{WORKSPACE}-{SANDBOX_NAME}` — sandbox-specific context

### Memoir naming convention

- `{WORKSPACE}-architecture` — system design, component graph
- `{WORKSPACE}-domain-model` — business entities and relationships
- `{WORKSPACE}-api-contracts` — endpoints, schemas, dependencies

### Rules

1. NEVER use bare topic names like `context` or `architecture` — ALWAYS prefix with workspace name
2. NEVER use bare memoir names like `project-architecture` — ALWAYS prefix: `{WORKSPACE}-architecture`
3. When recalling, ALWAYS filter by workspace-prefixed topic
4. When storing, ALWAYS use workspace-prefixed topic

### Version-Aware Operational Resolution

If `.specify/memory/versions/active.json` exists and the current workspace is
registered in it, the workspace is operating in versioned-memory mode.

In that mode:

1. Resolve the active memory version before operational recall/store or any
    sync/rollback mutation, using `node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"`
    or the equivalent in-process script call.
2. Treat canonical aliases such as `{WORKSPACE}-context`,
    `{WORKSPACE}-architecture`, and `{WORKSPACE}-errors-resolved` as logical
    topics governed by the resolved manifest and dynamic constitution snapshot,
    not as timeless unversioned targets.
3. Sync/import flows MUST require explicit `sourceWorkspace` and
    `sourceVersionId` before preparing a candidate manifest.
4. Rollback flows MUST require explicit `targetVersionId` and a reason, and
    MUST only restore the registered `previousVersionId` unless a stricter
    governed workflow expands eligibility.
5. Mutate `active.json`, manifests, and dynamic constitutions only through the
    managed lifecycle scripts under `scripts/memory-sync/`, never by inference.

## Method 2: Memoirs (Knowledge Graph)

Permanent structured knowledge. Concepts linked by typed relations. Use for architecture, dependencies, component relationships. **Memoirs NEVER decay** — they are refined, never deleted.

### MCP Tools

| Tool                     | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `icm_memoir_create`      | Create a new memoir (knowledge container)                      |
| `icm_memoir_list`        | List all memoirs                                               |
| `icm_memoir_show`        | Show memoir details and all concepts                           |
| `icm_memoir_add_concept` | Add a concept with labels                                      |
| `icm_memoir_refine`      | Update a concept's definition                                  |
| `icm_memoir_search`      | Full-text search within a memoir, optionally filtered by label |
| `icm_memoir_search_all`  | Search across ALL memoirs                                      |
| `icm_memoir_link`        | Create typed relation between concepts                         |
| `icm_memoir_inspect`     | Inspect concept and graph neighborhood (BFS traversal)         |
| `icm_memoir_export`      | Export graph (formats: `json`, `dot`, `ascii`, `ai`)           |

### When to Use

| When                          | Action                                                      |
| ----------------------------- | ----------------------------------------------------------- |
| New component/service defined | `icm_memoir_add_concept(memoir, name, description, labels)` |
| Relationship discovered       | `icm_memoir_link(memoir, from, to, relation)`               |
| Understanding evolves         | `icm_memoir_refine(memoir, concept, new_description)`       |
| Need architectural context    | `icm_memoir_search(memoir, query)`                          |
| Decision superseded           | `icm_memoir_link(from, to, relation: "superseded_by")`      |
| End of feature/archive        | `icm_memoir_export(memoir, format: "ai")` — LLM-optimized   |
| Project scan/init             | CLI: `icm learn` — auto-generates Memoir                    |

### Relation types

`part_of` · `depends_on` · `related_to` · `contradicts` · `refines` · `alternative_to` · `caused_by` · `instance_of` · `superseded_by`

### Memoir naming

Use the project-prefixed convention defined above:

- `{WORKSPACE}-architecture` — system design, component graph
- `{WORKSPACE}-domain-model` — business entities and relationships
- `{WORKSPACE}-api-contracts` — endpoints, schemas, dependencies

## Method 3: Feedback (Learning from Mistakes)

Record corrections when predictions or assumptions are wrong. Search before making predictions. **Feedback topics MUST be project-prefixed** — use `{WORKSPACE}-{category}` (e.g., `Trackwise-architecture`, `Trackwise-dotnet-packages`) to avoid cross-project confusion.

### Feedback topic naming convention

- `{WORKSPACE}-architecture` — structural and design prediction errors
- `{WORKSPACE}-dotnet-packages` — NuGet package API assumptions
- `{WORKSPACE}-dotnet-ef-migrations` — EF Core migration tooling
- `{WORKSPACE}-go-supertokens` — Go auth-service SDK usage
- `{WORKSPACE}-frontend` — Nuxt/Vue/TypeScript prediction errors

### MCP Tools

| Tool                  | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `icm_feedback_record` | Record a correction when an AI prediction was wrong                |
| `icm_feedback_search` | Search past corrections to inform future predictions               |
| `icm_feedback_stats`  | Feedback statistics: total count, breakdown by topic, most applied |

### When to Use

| When                       | Action                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Assumption was wrong       | `icm_feedback_record(topic: "{WORKSPACE}-{category}", prediction, correction, context)` |
| About to make a prediction | `icm_feedback_search(query)` — check past mistakes first                                |
| Retrospective/verify phase | `icm_feedback_stats()` — review error patterns                                          |

## Method 4: Transcripts (Verbatim Session Replay)

Store every message exchanged with an agent as-is — no summarization, no extraction. Useful for session replay, post-mortem review, and auditing.

### MCP Tools

| Tool                           | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `icm_transcript_start_session` | Create a session for verbatim message capture; returns session_id |
| `icm_transcript_record`        | Append a raw message (role, content, optional tool + tokens)      |
| `icm_transcript_search`        | FTS5 search across messages (BM25, boolean, phrase, prefix)       |
| `icm_transcript_show`          | Replay full message thread of a session, chronologically          |
| `icm_transcript_stats`         | Sessions, messages, bytes, breakdown by role/agent/top-sessions   |

### Transcript Scope Policy

Transcripts are **NOT recorded in every phase**. Only two SDD phases justify the cost of verbatim recording:

| Phase                    | Record? | Why                                                                                                        |
| ------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| Explore (`/sdd-new`)     | **YES** | Captures the Owner's original intent in natural language — this context is lost when Memories summarize it |
| Specify                  | No      | Spec artifacts capture the structured output                                                               |
| Plan/Design              | No      | Architecture decisions go to Memories + Memoirs                                                            |
| Tasks                    | No      | Task list is its own artifact                                                                              |
| Implement                | No      | Code goes to git, progress to Memories                                                                     |
| Verify                   | No      | Verify report is the formal artifact                                                                       |
| Archive (`/sdd-archive`) | **YES** | Captures final decisions, what was deliberately excluded, closure rationale — the "acta de cierre"         |

### When to Use

| When                       | Action                                                                      |
| -------------------------- | --------------------------------------------------------------------------- |
| `/sdd-new` starts          | `icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")` |
| `/sdd-archive` starts      | `icm_transcript_start_session(agent: "supervisor", project: "{WORKSPACE}")` |
| Post-mortem / audit needed | `icm_transcript_search(query)`                                              |
| Archive phase              | `icm_transcript_show(session_id)` for full replay                           |

## SDD Phase × ICM Matrix

| SDD Phase            | Memories                                         | Memoirs                                            | Feedback                      | Transcripts                |
| -------------------- | ------------------------------------------------ | -------------------------------------------------- | ----------------------------- | -------------------------- |
| Init (`/init`)       | store `{WORKSPACE}-context` (critical)           | create `{WORKSPACE}-architecture`, run `icm learn` | —                             | —                          |
| Explore (`/sdd-new`) | recall `{WORKSPACE}-context`                     | search `{WORKSPACE}-architecture`                  | search past mistakes          | **start session + record** |
| Specify              | store in `sdd-{WORKSPACE}-{FEATURE}-TASK` (high) | —                                                  | —                             | —                          |
| Plan/Design          | store in `sdd-{WORKSPACE}-{FEATURE}-TASK` (high) | add/link in `{WORKSPACE}-architecture`             | check past design errors      | —                          |
| Tasks                | store in `sdd-{WORKSPACE}-{FEATURE}-TASK` (high) | —                                                  | —                             | —                          |
| Implement            | store progress (medium, every 3-5 tasks)         | refine `{WORKSPACE}-architecture`                  | record corrections            | —                          |
| Verify               | store QA report (high) + `icm_memory_health()`   | —                                                  | record findings as feedback   | —                          |
| Archive              | consolidate `sdd-{WORKSPACE}-{FEATURE}-TASK`     | export (format: ai)                                | review `icm_feedback_stats()` | **start session + record** |

## Mandatory Rules

1. **NEVER start work without recalling** — always `icm_memory_recall` first
2. **NEVER end a phase without storing** — always persist results
3. **Architecture decisions go to BOTH** memories (episodic, `critical`) AND memoirs (graph)
4. **Mistakes ALWAYS get recorded** as feedback — no silent failures
5. **Consolidate when topics exceed 7 entries** — keep memory clean
6. **Search feedback before predictions** — learn from past errors
7. **NEVER use `medium` for decisions, specs, plans, or conventions** — these MUST be `high` or `critical`
8. **Project context and stack info is ALWAYS `critical`** — it must survive project inactivity
9. **Run `icm_memory_health()` during Verify phase** — audit topic hygiene before closing
10. **Use `icm_memoir_export(format: "ai")` in Archive** — generates LLM-optimized context snapshot
11. **SESSION START — FIRST ACTION, NO EXCEPTIONS**: Before writing any code, answering any question, or performing any task, you MUST run:
    ```bash
    icm recall "current work" -t "{WORKSPACE}-context"
    icm recall "pending tasks" -t "sdd-{WORKSPACE}"
    ```
    If MCP tools are available: `icm_memory_recall(query: "current work", topic: "{WORKSPACE}-context")` first.
    **No recall = protocol violation.** There is no exception for "simple" tasks — every session starts with recall.
12. **CONSOLIDATION**: When a topic exceeds 7 entries, `icm_memory_store` warns. Run `icm_memory_consolidate(topic)` **immediately** — do not defer.
13. **SERVICE DISCOVERY GATE**: Before the Functional Analyst produces `requirement.md`, they MUST search ICM for existing services: `icm_memory_recall(query: "services", topic: "{WORKSPACE}-services-catalog")`. Discoveries are persisted with `importance: "high"`. Without evidence of this step, `/sdd-verify` emits automatic FAIL.
14. **CLI SHORTCUTS** (project-aware, auto-detect `{WORKSPACE}`):
    ```bash
    icm recall-project          # recall all context for current workspace
    icm save-project "summary"  # store under {WORKSPACE}-context
    icm wake-up                 # critical-facts pack for prompt injection
    icm learn                   # scan project → auto-generate Memoir graph
    ```
15. **VERSION-AWARE MEMORY GATE**: If `.specify/memory/versions/active.json` exists and the workspace is registered, resolve the active version first. Syncs MUST declare `sourceWorkspace` + `sourceVersionId`; rollbacks MUST declare `targetVersionId` + reason.

## Long-term Health

ICM's decay runs globally on every recall. To prevent memory degradation across workspaces:

- **Inactive workspaces**: memories with `medium` importance WILL decay and MAY be pruned. This is by design — ephemeral progress notes are meant to expire.
- **Workspace revival**: when resuming work on an inactive workspace, run `icm_memory_recall` + `icm_memoir_search` to rebuild context from permanent sources (memoirs never decay).
- **Consolidation**: ALWAYS consolidate topics with 7+ entries. Consolidated summaries reset their weight to 1.0, effectively "refreshing" them. Run `icm_memory_consolidate(topic)` immediately when warned.
- **Feedback is workspace-scoped**: ALWAYS prefix feedback topics with `{WORKSPACE}-` (e.g., `bsc-portal-architecture`). This prevents cross-workspace confusion when multiple workspaces share similar tech stacks.
- **Health audit**: run `icm_memory_health()` during the Verify phase AND periodically — it reports per-topic entry count, average weight, stale entries, and consolidation needs.

## Visualization

- **TUI dashboard**: `icm dashboard` — 5 tabs (Overview, Topics, Memories, Health, Memoirs). Keyboard: `j/k` nav, `1-5` tabs, `/` search.
- **Web dashboard**: when available via `icm serve --expose` — Three.js force-directed graph at `http://127.0.0.1:8420`.

## Auto-Extraction Hooks (Zero LLM Cost)

ICM hooks run automatically in supported tools. You do NOT need to call them:

| Hook               | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `SessionStart`     | Injects wake-up pack of critical/high memories at session start |
| `PreToolUse`       | Auto-allows `icm` CLI commands (no permission prompt)           |
| `PostToolUse`      | Extracts facts from tool output every N calls (rule-based)      |
| `PreCompact`       | Extracts memories before context compression                    |
| `UserPromptSubmit` | Injects recalled context at start of each user prompt           |

**Important**: Hooks only capture incidental facts. You MUST still explicitly store important decisions, architecture changes, and phase completions.
