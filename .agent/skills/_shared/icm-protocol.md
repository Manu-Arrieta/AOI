# ICM Protocol — Shared Convention (v3)

> This protocol is ALWAYS active. All agents MUST follow it.

## How to Use ICM in This Environment

ICM provides two access modes. MCP is primary, CLI is fallback:

### Mode 1 — MCP Tools (MANDATORY, primary)

ICM exposes 27 MCP tools. These are ALWAYS available. Use them directly:

```
icm_memory_store(topic: "{WORKSPACE}-context", content, importance, keywords)
icm_memory_recall(query, topic: "{WORKSPACE}-context")
icm_memory_update(id, content?, importance?, keywords?)
icm_memory_health()
icm_memoir_add_concept(memoir: "{WORKSPACE}-architecture", name, definition, labels)
icm_memoir_export(memoir: "{WORKSPACE}-architecture", format: "ai")
icm_feedback_record(topic, prediction, correction, context)
icm_transcript_start_session(agent, project)
```

### Mode 2 — CLI Fallback (Antigravity / no MCP tools)

If MCP tools are NOT in your tool list, use `icm` from PATH via terminal:

```bash
icm store -t "{WORKSPACE}-context" -c "..." -i critical -k "key1,key2"
icm recall "query" -t "{WORKSPACE}-context"
icm memoir add-concept -m "{WORKSPACE}-architecture" -n "name" -d "definition"
icm feedback record -t "sdd-{WORKSPACE}" --predicted "X" --corrected "Y" --context "Z"
icm health
```

Do **NOT** hardcode OS-specific absolute paths. `setup.sh` and `setup.ps1` are responsible for making `icm` available in PATH for the workspace.

**NEVER offer to install ICM manually** — it is always pre-installed by project setup. If the binary is missing, tell the user to rerun `setup.sh` on macOS/Linux or `setup.ps1` on Windows.

### CLI Shortcuts (project-aware, auto-detect `{WORKSPACE}`)

```bash
icm recall-project          # recall all context for current project
icm save-project "summary"  # store under {WORKSPACE}-context
icm wake-up                 # critical-facts pack for prompt injection
icm learn                   # scan project → auto-generate Memoir graph
```

## Auto-Extraction Hooks

ICM hooks run automatically — zero LLM cost. You do NOT need to call them:

| Hook               | What it does                                                    |
| ------------------ | --------------------------------------------------------------- |
| `SessionStart`     | Injects wake-up pack of critical/high memories at session start |
| `PreToolUse`       | Auto-allows `icm` CLI commands (no permission prompt)           |
| `PostToolUse`      | Extracts facts from tool output every N calls (rule-based)      |
| `PreCompact`       | Extracts memories before context compression                    |
| `UserPromptSubmit` | Injects recalled context at start of each user prompt           |

**Important**: Hooks only capture incidental facts. You MUST still explicitly store important decisions, architecture changes, and phase completions.

## Project Isolation

ICM uses ONE global database. To prevent memory bleed between projects, ALL topics and memoirs MUST be prefixed with the project name.

Use `{WORKSPACE}` as identifier (auto-detected from git remote or directory name).

**Topic convention**: `{WORKSPACE}-context`, `sdd-{WORKSPACE}-{FEATURE}-TASK-YYYY-NNN`, `{WORKSPACE}-services-catalog`, `{WORKSPACE}-session-summaries`, `{WORKSPACE}-errors-resolved`, `sandbox-{WORKSPACE}-{SANDBOX_NAME}`

**Memoir convention**: `{WORKSPACE}-architecture`, `{WORKSPACE}-domain-model`, `{WORKSPACE}-api-contracts`

**Rule**: NEVER use bare names like `context` or `architecture`. ALWAYS include project prefix.

## Version-Aware Memory Resolution

If `.specify/memory/versions/active.json` exists and includes `{WORKSPACE}`,
the workspace is operating in versioned-memory mode.

1. Resolve the active version first via `node scripts/memory-sync/resolve-active-version.mjs "$WORKSPACE"`
	or the equivalent script call.
2. Treat canonical aliases like `{WORKSPACE}-context` and
	`{WORKSPACE}-architecture` as logical topics governed by the resolved
	manifest and dynamic constitution snapshot.
3. Sync/import flows MUST require explicit `sourceWorkspace` and
	`sourceVersionId` before candidate preparation.
4. Rollback flows MUST require explicit `targetVersionId` and reason, and must
	only restore the registered `previousVersionId` unless a stricter workflow
	says otherwise.
5. Use the managed lifecycle scripts under `scripts/memory-sync/` for candidate
	preparation, activation, and rollback. Never mutate `active.json` or
	manifests by inference.

## Four Memory Methods

### 1. Memories (Episodic)

Store/recall temporal context with importance-based decay.

#### MCP Tools

| Tool                     | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `icm_memory_store`       | Store with auto-dedup (>85% similarity → update) |
| `icm_memory_recall`      | Search by query, filter by topic/keyword         |
| `icm_memory_update`      | Edit in-place (content, importance, keywords)    |
| `icm_memory_forget`      | Delete by ID                                     |
| `icm_memory_consolidate` | Merge topic into one summary                     |
| `icm_memory_list_topics` | List topics with counts                          |
| `icm_memory_stats`       | Global statistics                                |
| `icm_memory_health`      | Per-topic hygiene audit                          |
| `icm_memory_embed_all`   | Backfill embeddings                              |

#### Importance Policy (MANDATORY)

| Importance | Decay    | Auto-prune | Use for                                                           |
| ---------- | -------- | ---------- | ----------------------------------------------------------------- |
| `critical` | **NONE** | never      | Project context, stack, team, architecture decisions, conventions |
| `high`     | slow     | never      | Specs, plans, completed tasks, design decisions, QA reports       |
| `medium`   | normal   | yes        | Implementation progress, batch checkpoints, intermediate notes    |
| `low`      | fast     | yes        | Experimental ideas, temporary notes, exploration results          |

**Rule**: When in doubt, use `high`. Never use `medium` for decisions, specs, plans, or conventions.

### 2. Memoirs (Knowledge Graph)

Permanent structured knowledge. Concepts + typed relations. **Never decay** — refined, not deleted.

#### MCP Tools

| Tool                     | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `icm_memoir_create`      | Create memoir container                     |
| `icm_memoir_list`        | List all memoirs                            |
| `icm_memoir_show`        | Show details + all concepts                 |
| `icm_memoir_add_concept` | Add concept with labels                     |
| `icm_memoir_refine`      | Update concept definition                   |
| `icm_memoir_search`      | Full-text search, optional label filter     |
| `icm_memoir_search_all`  | Search across ALL memoirs                   |
| `icm_memoir_link`        | Create typed relation                       |
| `icm_memoir_inspect`     | Inspect neighborhood (BFS)                  |
| `icm_memoir_export`      | Export graph (`json`, `dot`, `ascii`, `ai`) |

Relations: `part_of` · `depends_on` · `related_to` · `contradicts` · `refines` · `alternative_to` · `caused_by` · `instance_of` · `superseded_by`

### 3. Feedback (Corrections)

Learn from mistakes. Search before predicting. **Feedback topics MUST be project-prefixed** — use `{WORKSPACE}-{category}` (e.g., `Trackwise-architecture`, `Trackwise-dotnet-packages`).

| Tool                  | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `icm_feedback_record` | Record correction (prediction vs. actual)  |
| `icm_feedback_search` | Search past corrections                    |
| `icm_feedback_stats`  | Stats: total count, by topic, most applied |

### 4. Transcripts (Verbatim Session Replay)

Store messages as-is for replay, audit, post-mortem.

| Tool                           | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `icm_transcript_start_session` | Create session; returns session_id |
| `icm_transcript_record`        | Append raw message                 |
| `icm_transcript_search`        | FTS5 search across messages        |
| `icm_transcript_show`          | Replay session chronologically     |
| `icm_transcript_stats`         | Global transcript statistics       |

## SDD Phase × ICM Matrix

| SDD Phase   | Memories                           | Memoirs               | Feedback             | Transcripts   |
| ----------- | ---------------------------------- | --------------------- | -------------------- | ------------- |
| Init        | store context (critical)           | create + `icm learn`  | —                    | —             |
| Explore     | recall context                     | search architecture   | search past mistakes | start session |
| Specify     | store spec (high)                  | —                     | —                    | —             |
| Plan/Design | store plan (high)                  | add/link architecture | check past errors    | —             |
| Tasks       | store tasks (high)                 | —                     | —                    | —             |
| Implement   | progress (medium, every 3-5 tasks) | refine architecture   | record corrections   | —             |
| Verify      | QA report (high) + health audit    | —                     | record findings      | —             |
| Archive     | consolidate topic                  | export (format: ai)   | review stats         | search audit  |

## Mandatory Rules

1. ALWAYS recall before starting work
2. ALWAYS store after completing work
3. Architecture decisions → memories (`critical`) AND memoirs
4. Mistakes → feedback (no silent failures)
5. Consolidate topics with 7+ entries
6. Search feedback before making predictions
7. NEVER use bare topic/memoir names — ALWAYS prefix with project name
8. NEVER use `medium` for decisions, specs, plans, or conventions — use `high` or `critical`
9. Project context and stack info is ALWAYS `critical`
10. Run `icm_memory_health()` during Verify — audit before closing
11. Use `icm_memoir_export(format: "ai")` in Archive — LLM-optimized snapshot
12. **SESSION START — FIRST ACTION**: Before any task, recall: `icm_memory_recall(query: "current work", topic: "{WORKSPACE}-context")`. No recall = protocol violation.
13. **CONSOLIDATION**: When a topic exceeds 7 entries, consolidate immediately: `icm_memory_consolidate(topic)`. Do not defer.
14. **SERVICE DISCOVERY GATE**: Before producing `requirement.md`, Functional Analyst MUST search: `icm_memory_recall(query: "services", topic: "{WORKSPACE}-services-catalog")`. Without evidence, `/sdd-verify` auto-FAILs.
15. **TRANSCRIPT SCOPE**: Transcripts are ONLY recorded during Explore (`/sdd-new`) and Archive (`/sdd-archive`) phases.
16. **VERSION-AWARE MEMORY GATE**: If `.specify/memory/versions/active.json` exists and the workspace is registered, resolve the active version first. Syncs MUST declare `sourceWorkspace` + `sourceVersionId`; rollbacks MUST declare `targetVersionId` + reason.

## Long-term Health

- **Inactive projects**: `medium` memories decay and may be pruned — by design for ephemeral notes
- **Project revival**: use `icm_memory_recall` + `icm_memoir_search` to rebuild (memoirs never decay)
- **Consolidation**: always consolidate topics with 7+ entries — resets weight to 1.0
- **Feedback is project-scoped**: ALWAYS prefix feedback topics with `{WORKSPACE}-` (e.g., `Trackwise-architecture`). Prevents cross-project confusion when multiple projects share similar tech stacks.
- **Health audit**: `icm_memory_health()` reports entry count, average weight, stale entries, consolidation needs
