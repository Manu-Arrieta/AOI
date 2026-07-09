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

Do NOT store: trivial details, info already in CLAUDE.md, ephemeral state (build logs, git status).

### Other commands
```bash
icm update <id> -c "updated content"     # edit memory in-place
icm health                                # topic hygiene audit
icm topics                                # list all topics
```

### MCP Tool Activation

At the start of every session, ensure the following MCP tool groups are ENABLED:

```
activate_knowledge_graph_management_tools   # ICM memoir_*, memory_extract_patterns, learn
activate_long_term_memory_management_tools  # ICM memory_*, feedback_* (if available)
activate_project_management_tools           # codebase-memory index/status
activate_feedback_management_tools          # ICM feedback_record/search/stats
activate_transcript_management_tools        # ICM transcript_start/record/search/show
activate_memory_consolidation_tools         # ICM memory_consolidate, memory_forget_topic
activate_code_analysis_and_search_tools     # codebase-memory search_graph/code/trace_path/query_graph
```

Without this activation, the `memoir_*`, `memory_*`, `codebase-memo_*` tools will appear "disabled". Activate them BEFORE calling any ICM or codebase operation.
```
<!-- icm:end -->

<!-- headroom:start -->
## Headroom — MANDATORY context compression layer

This project requires `headroom` (headroomlabs-ai/headroom) installed and configured. Headroom is the mandatory token-compression layer of the AOI bootstrapper.

- Phase 1.6 of `setup.sh` / `setup.ps1` installs Headroom non-interactively. Setup aborts if it fails.
- All sessions and agents run with `HEADROOM_HOST`, `HEADROOM_PORT`, `HEADROOM_PROXY_PORT` exported.
- Verify `headroom --version` resolves in PATH before executing any LLM-bound command.
- Do NOT modify this section: it is governed by AOI bootstrap policy.
<!-- headroom:end -->
