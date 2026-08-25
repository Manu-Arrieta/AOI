<!-- icm:start -->
## Persistent memory (ICM) — MANDATORY

This project uses [ICM](https://github.com/rtk-ai/icm) for persistent memory across sessions.
You MUST use it actively. Not optional.

### Recall (before starting work)
```bash
icm recall "query"                        # search memories
icm recall "query" -t "topic-name"        # filter by topic
icm recall-context "query" --limit 5      # formatted for prompt injection
```

### Store — MANDATORY triggers
You MUST call `icm store` when ANY of the following happens:
1. **Error resolved** → `icm store -t errors-resolved -c "description" -i high -k "keyword1,keyword2"`
2. **Architecture/design decision** → `icm store -t decisions-{project} -c "description" -i high`
3. **User preference discovered** → `icm store -t preferences -c "description" -i critical`
4. **Significant task completed** → `icm store -t context-{project} -c "summary of work done" -i high`
5. **Conversation exceeds ~20 tool calls without a store** → store a progress summary

Do this BEFORE responding to the user. Not after. Not later. Immediately.

Do NOT store: trivial details, info already in copilot-instructions.md, ephemeral state (build logs, git status).

### Other commands
```bash
icm update <id> -c "updated content"     # edit memory in-place
icm health                                # topic hygiene audit
icm topics                                # list all topics
```

### MCP Tool Activation & Runtime Invariant

At the start of EVERY session, verify and ensure all 7 MCP tool groups are ACTIVE:

```
activate_knowledge_graph_management_tools   # ICM memoir_*, memory_extract_patterns, learn
activate_long_term_memory_management_tools  # ICM memory_*, feedback_*
activate_project_management_tools           # codebase-memory index/status
activate_feedback_management_tools          # ICM feedback_record/search/stats
activate_transcript_management_tools        # ICM transcript_start/record/search/show
activate_memory_consolidation_tools         # ICM memory_consolidate, memory_forget_topic
activate_code_analysis_and_search_tools     # codebase-memory search_graph/code/trace_path/query_graph
```

**Zero-Disabled-Tools Invariant**:
1. Activate all 7 tool groups at session start BEFORE calling any memory or code search operations.
2. If at ANY point during execution an ICM (`memoir_*`, `memory_*`, `feedback_*`, `transcript_*`) or Codebase (`codebase-memo_*`, `search_graph`, `search_code`) tool appears as "disabled", unavailable, or uncalled, **IMMEDIATELY execute the corresponding `activate_*` tool** to restore full capabilities before continuing.
<!-- icm:end -->

## Sandbox, Services, and Integration Standard

1. Any sandbox for components, pages, or flows must preserve a migratable chain: UI entrypoint -> state boundary -> service boundary -> execution client or contract adapter.
2. Components, pages, and stores must not contain runtime selection between real and temporary implementations.
3. Real execution truth belongs in service boundaries. The contract must live in code and types, not in runtime diagnostic metadata.
4. Temporary behavior for prototyping or testing must be isolated in sandbox-only adapters, fixtures, or explicit environment flags outside the normal UI or state path.
5. E2E and QA tooling must not shape runtime architecture. Test doubles belong in test infrastructure.
6. Any artifact expected to integrate later must be removable from temporary behavior before migration unless the Owner explicitly approves an exception.
7. Verification must treat prototype-only runtime branches, sandbox-only dependencies, and diagnostic surfaces as blockers until they are removed or explicitly accepted.
