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

<!-- icm:end -->

<!-- headroom:start -->

## Headroom — MANDATORY context compression layer

This project requires `headroom` (headroomlabs-ai/headroom) installed and configured. Headroom is the mandatory token-compression layer of the AOI bootstrapper.

- Phase 1.6 of `setup.sh` / `setup.ps1` installs Headroom non-interactively. Setup aborts if it fails.
- All sessions and agents run with `HEADROOM_HOST`, `HEADROOM_PORT`, `HEADROOM_PROXY_PORT` exported.
- Verify `headroom --version` resolves in PATH before executing any LLM-bound command.
- Do NOT modify this section: it is governed by AOI bootstrap policy.
<!-- headroom:end -->

## Code Discovery Protocol (optional, when `codebase-memory-mcp` is present)

If the workspace registers `codebase-memory-mcp` in `.vscode/mcp.json`, prefer graph-based discovery before broad `grep` plus file-by-file reads.

Priority order:

1. `search_graph`
2. `trace_path`
3. `get_code_snippet`
4. `query_graph`
5. `get_architecture`
6. `search_code` or `grep` only for literals, configs, non-code files, or fallback

If the project is not indexed yet, run `index_repository` first. If the MCP server is absent, use the normal local search flow.
