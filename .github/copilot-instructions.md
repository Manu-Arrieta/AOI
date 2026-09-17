<!-- AOI / .github/copilot-instructions.md — Auto-compiled by aoi:sync-rules -->
<!-- icm:start -->
## Persistent memory (ICM) — MANDATORY

This project uses [ICM](https://github.com/rtk-ai/icm) for persistent memory across sessions.
You MUST use it actively. Not optional.

### MCP tool activation — do this FIRST
Activate the ICM tool groups before the first recall; re-run the group if
any ICM or Codebase MCP tool reports as disabled mid-session.

```text
activate_knowledge_graph_management_tools
activate_long_term_memory_management_tools
activate_project_management_tools
activate_feedback_management_tools
activate_transcript_management_tools
activate_memory_consolidation_tools
activate_code_analysis_and_search_tools
```

### Recall (before starting work)
```bash
icm recall "query"                        # search memories
icm recall "query" -t "topic-name"        # filter by topic
icm recall-context "query" --limit 5      # formatted for prompt injection
```

### Store Triggers (MANDATORY) — derivado de `.github/instructions/icm-protocol.instructions.md`

`icm store -t <topic> -c "<description>" -i <importance>` · topics: `AOI-decisions`,
`AOI-context`, `errors-resolved`, `preferences`.

- `-i critical` → project stack o contexto · decisión de arquitectura · convención establecida · preferencia del Owner (topic `preferences`)
- `-i high` → spec o plan producido · tarea completada · reporte de QA o verify · error resuelto (topic `errors-resolved`)
- `-i medium` → progreso de implementación, checkpoint cada 3-5 tareas
- `-i low` → notas de exploración, ideas temporales (se podan solas)

Configuración exacta como hecho O(1): `icm facts set "AOI" "key" "value"`.

Además: si la conversación pasa ~20 llamadas a herramientas sin un store, guardá un resumen de progreso.

Do this BEFORE responding to the user. Not after. Not later. Immediately.

Do NOT store: trivial details, info already in CLAUDE.md, ephemeral state (build logs, git status).

### Other commands
```bash
icm facts set "AOI" "key" "value"  # deterministic exact fact (O(1))
icm wake-up                              # instant critical facts pack
icm update <id> -c "updated content"     # edit memory in-place
icm health                                # topic hygiene audit
icm topics                                # list all topics
```
<!-- icm:end -->
