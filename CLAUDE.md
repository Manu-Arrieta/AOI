<!-- AOI / CLAUDE.md — Auto-compiled by aoi:sync-rules -->
# AOI — Agentic Operational Infrastructure (AOI)

## Persistent Memory (ICM v0.10+ Protocol v4) — MANDATORY

This project operates with **Infinite Context Memory (ICM)**. You MUST use it actively.

### Recall (Before Starting Any Task)
```bash
icm wake-up                              # Instant deterministic facts pack
icm recall "query"                        # Search episodic memories
icm recall "query" -t "AOI-context"        # Filter by project topic
icm facts list "AOI"             # O(1) exact project facts
```

### Store Triggers (MANDATORY)
1. **Error resolved** → `icm store -t errors-resolved -c "description" -i high -k "keyword1,keyword2"`
2. **Architecture / Design decision** → `icm store -t decisions-AOI -c "description" -i high`
3. **User preference discovered** → `icm store -t preferences -c "description" -i critical`
4. **Task completed** → `icm store -t context-AOI -c "summary" -i high`
5. **Exact configuration / endpoint / service** → `icm facts set "AOI" "key" "value"`

### Workspace Health Diagnostic (0 Tokens)
```bash
pnpm aoi:doctor                          # 360° Repository health check
```

### SDD Workflow Commands (Read from .github/prompts/<command>.prompt.md)
- `/init` — Bootstrap project, ICM facts, and base project map (`.github/prompts/init.prompt.md`)
- `/sdd-new` — Explore domain, discover services, and author proposal (`.github/prompts/sdd-new.prompt.md`)
- `/sdd-apply` — Implement planned tasks with TDD & Fiber sandboxes (`.github/prompts/sdd-apply.prompt.md`)
- `/sdd-verify` — Verify implementation, test gates, and SRP limits (<300 LOC) (`.github/prompts/sdd-verify.prompt.md`)
- `/sdd-archive` — Close task, distill patterns, and refresh fast briefings (`.github/prompts/sdd-archive.prompt.md`)
