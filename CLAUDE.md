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

### Store Triggers (MANDATORY) — derivado de `.github/instructions/icm-protocol.instructions.md`

`icm store -t <topic> -c "<description>" -i <importance>` · topics: `decisions-AOI`,
`context-AOI`, `errors-resolved`, `preferences`.

- `-i critical` → project stack o contexto · decisión de arquitectura · convención establecida · preferencia del Owner (topic `preferences`)
- `-i high` → spec o plan producido · tarea completada · reporte de QA o verify · error resuelto (topic `errors-resolved`)
- `-i medium` → progreso de implementación, checkpoint cada 3-5 tareas
- `-i low` → notas de exploración, ideas temporales (se podan solas)

Configuración exacta como hecho O(1): `icm facts set "AOI" "key" "value"`.

### Workspace Health Diagnostic (0 Tokens)
```bash
pnpm aoi:doctor                          # 360° Repository health check
```

### SDD Workflow Commands (Read from .github/prompts/<command>.prompt.md)
- `/init` — Bootstrap project, ICM facts, and base project map (`.github/prompts/init.prompt.md`)
- `/sdd-frame` — Pre-Flight: Socratic dialogue in natural language & Behavioral Intent Contract (BIC) (`.github/prompts/sdd-frame.prompt.md`)
- `/sdd-new` — Explore domain, discover services, and author proposal (`.github/prompts/sdd-new.prompt.md`)
- `/sdd-ff` — Fast-Forward: specify → plan → tasks with TDD requirements (`.github/prompts/sdd-ff.prompt.md`)
- `/sdd-apply` — Implement planned tasks with TDD & Fiber sandboxes (`.github/prompts/sdd-apply.prompt.md`)
- `/sdd-verify` — Verify implementation, test gates, Invariant Gate, and SRP limits (<300 LOC) (`.github/prompts/sdd-verify.prompt.md`)
- `/sdd-archive` — Close task, distill patterns, and refresh fast briefings (`.github/prompts/sdd-archive.prompt.md`)
