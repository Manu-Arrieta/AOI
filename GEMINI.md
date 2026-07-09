# GEMINI.md — Antigravity System Instructions

You are an **ecosystem of specialized agents** governed by Hub-and-Spoke orchestration, Spec-Driven Development (spec-kit), and ICM persistent memory.

## Tool PATH Setup (CRITICAL)

AOI (Agentic Operational Infrastructure) configures the workspace terminal PATH during setup so `rtk` and `icm` resolve on macOS, Linux, and Windows.

**Mandatory rule:**
Use `rtk` and `icm` directly in terminal commands. Do **NOT** hardcode OS-specific absolute paths such as `/opt/homebrew/bin/rtk` or `/opt/homebrew/bin/icm`.

If either command is missing, tell the user to rerun the project installer:

- `setup.sh` on macOS / Linux
- `setup.ps1` on Windows

## RTK Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/rtk/SKILL.md`

All shell commands MUST be prefixed with `rtk`. Non-negotiable.

## ICM Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/_shared/icm-protocol.md`

Four mandatory memory systems:

1. **Memories** — episodic store/recall with decay by importance
2. **Memoirs** — permanent knowledge graphs with typed relations
3. **Feedback** — corrections for learning from mistakes
4. **Transcripts** — verbatim session replay (ONLY during Explore + Archive phases)

Use all four throughout SDD phases. Use `icm` for CLI fallback.

Auto-extraction hooks handle automatic recall/extraction. You STILL must explicitly store decisions, architecture, and phase completions.

### MCP Tool Activation (Antigravity)

At the start of every session, ensure these MCP tool groups are ENABLED:

```
activate_knowledge_graph_management_tools   # ICM memoir_*, memory_extract_patterns, learn
activate_long_term_memory_management_tools  # ICM memory_*, feedback_*
activate_project_management_tools           # codebase-memory index/status
activate_feedback_management_tools          # ICM feedback_record/search/stats
activate_transcript_management_tools        # ICM transcript_start/record/search/show
activate_memory_consolidation_tools         # ICM memory_consolidate, memory_forget_topic
activate_code_analysis_and_search_tools     # codebase-memory search_graph/code/trace_path/query_graph
```

Without this activation, the `memoir_*`, `memory_*`, `codebase-memo_*` tools will appear "disabled". Activate them BEFORE any ICM or codebase operation.

## Workspace Detection

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

ALL ICM topics and memoirs MUST use `{WORKSPACE}` prefix. See ICM Protocol v3 for naming conventions.

## Agents

| Agent                  | Skill File                                       | SDD Phase                      |
| ---------------------- | ------------------------------------------------ | ------------------------------ |
| Supervisor             | `.agent/skills/agents/supervisor.md`             | Orchestration (all phases)     |
| Functional Analyst     | `.agent/skills/agents/functional-analyst.md`     | Explore, Specify               |
| Solution Architect     | `.agent/skills/agents/solution-architect.md`     | Plan, Tasks                    |
| Frontend Developer     | `.agent/skills/agents/frontend-developer.md`     | Implement (UI)                 |
| Backend Developer      | `.agent/skills/agents/backend-developer.md`      | Implement (API) — optional     |
| DevOps Engineer        | `.agent/skills/agents/devops-engineer.md`        | Implement (infra) — optional   |
| UX Designer            | `.agent/skills/agents/ux-designer.md`            | Design                         |
| Documentation Analyst  | `.agent/skills/agents/documentation-analyst.md`  | Archive                        |
| Integration Specialist | `.agent/skills/agents/integration-specialist.md` | Verify                         |
| Project Expert         | `.agent/skills/agents/project-expert.md`         | Domain Q&A — transversal       |
| Triage Specialist      | `.agent/skills/agents/triage-specialist.md`      | Bug & Definition — transversal |
| Resource Analyst       | `.agent/skills/agents/resource-analyst.md`       | Resources — transversal        |
| Project Analyzer       | `.agent/skills/agents/project-analyzer.md`       | Analysis — transversal         |

## SDD Lifecycle (via spec-kit)

```
/sdd-new      → Explore + Propose        (Supervisor → Functional Analyst)
/sdd-ff       → Specify → Plan → Tasks   (Functional Analyst → Solution Architect)
/sdd-apply    → Implement                (Domain agents via /speckit.implement)
/sdd-verify   → Verify + Health          (Integration Specialist)
/sdd-archive  → Documentation + Close    (Documentation Analyst)
/sandbox-new  → Create Sandbox           (Optional prototyping environment)
```

Spec-kit core commands: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`, `/speckit.checklist`

## Support Workflows

```
/new-resource-folder                → Create governed folder inside `.resources/`
/move-resource-folder               → Move governed folder inside `.resources/`
/delete-resource-folder             → Delete governed folder inside `.resources/`
/export-memory-bundle               → Export governed bundle inside `.exportsmemories/`
/import-memory-bundle               → Import bundle into a governed candidate version
/update-resource-governance-structure → Sync `.resources/constitution.md` with actual folder structure
```

## Dual-Sync Rule (MANDATORY)

All agents MUST exist in both:

- **Copilot**: `.github/agents/{name}.agent.md`
- **Antigravity**: `.agent/skills/agents/{name}.md`

When creating or modifying agents, ALWAYS update both locations.

## Model Selection Protocol (ALWAYS ACTIVE)

Read and follow: `.agent/skills/_shared/model-selection.md` (Antigravity) y `.github/instructions/model-selection.instructions.md` (Copilot). Ambos archivos espejan la misma doctrina vía `dual-sync.instructions.md`.

Para resumen rápido:

- **Razonamiento Abstracto**: `DeepSeek V4 Pro` (raíz) / `Qwen 3.7 Max` (Antigravity)
- **Implementación**: `GLM-5.2`
- **Catálogo NVIDIA customendpoint**: K2.7 Code (1 agente: supervisor), DeepSeek V4 Pro (6 agentes), GLM-5.2 (3 agentes), Qwen 3.7 Max (2 agentes), MiniMax M3 (1 agente: UX). **Requiere configuración previa del operador** — ver §5 abajo.
- **Fallback**: NUNCA decidir por defecto; avisar y dejar que el usuario elija. La jerarquía `Primary`+`Fallback` documenta un orden sugerido para la decisión humana, NO automatiza la selección.
- **Preeminencia**: el bloque `## Model Requirement` del agente индивидуаль reemplaza los defaults cuando es provisto.

### §5 — Customendpoint NVIDIA (paso opcional pero recomendado)

> ⚠️ **Default si NO se configura**: AOI sigue funcionando con razonamiento abstracto DeepSeek V4 Pro (raíz) / Qwen 3.7 Max (Antigravity) y GLM-5.2 para implementación. **El catálogo NVIDIA queda inerte hasta que el operador active el custom endpoint.**

**Orden recomendado de configuración** (una vez por máquina del operador):

1. **Tener API key de NVIDIA** (`https://integrate.api.nvidia.com/v1`). Configurar como variable de entorno o pegarla manualmente.
2. **Configurar el custom endpoint en VS Code**:
   - Archivo destino: `~/Library/Application Support/Code/User/ChatLanguageModel.json` (macOS), `~/.config/Code/User/ChatLanguageModel.json` (Linux), `%APPDATA%\Code\User\ChatLanguageModel.json` o `%APPDATA%\Roaming\Code\User\ChatLanguageModel.json` (Windows — ambas formas válidas; el helper prueba las dos secuencialmente).
   - Formato (array JSON con 5 modelos: `z-ai/glm-5.2`, `qwen/qwen3.7-max`, `deepseek-ai/deepseek-v4-pro`, `moonshotai/kimi-k2.7-code`, `minimaxai/minimax-m3`) — ver plantilla en `scaffold/.vscode/ChatLanguageModel.example.json` (trackeada, sin secret).
   - **Reemplazar** el placeholder `"APIKEY-CONFIGURADA-PREVIAMENTE"` por tu API key real.
3. **Reiniciar VS Code** para que los modelos aparezcan en el picker.
4. **Seleccionar manualmente** el `Primary` (o `Fallback`) por agente antes de invocar — los frontmatter `model:` no pueden asignarlos automáticamente.

**Forma automatizada**: `setup.sh` / `setup.ps1` ofrece Phase 1.5 que copia la plantilla al VS Code User dir del operador y recuerda reemplazar la API key. Es **opt-in** (`Y/n`), no-bloqueante, y se puede relanzar con `bash scripts/nvidia-vscode-setup.sh [--key <KEY>]` después.

**Invocación manual**:

```bash
bash scripts/nvidia-vscode-setup.sh --dry-run      # preview sin copiar
bash scripts/nvidia-vscode-setup.sh --yes --key <APIKEY>   # non-interactive
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -Yes -ApiKey <KEY>
```

**Seguridad**: el archivo `ChatLanguageModel.json` con API key real **NUNCA** se commitea — `.gitignore` excluye `ChatLanguageModel.json` y mantiene tracked sólo `ChatLanguageModel.example.json`.

### §6 — Capa de compresión Headroom (ortogonal a §5, opcional)

> ℹ️ **Scope real**: Headroom comprime contexto para agentes **CLI** (Claude Code, Codex, `gh copilot`). **No intercepta VS Code Copilot Chat** — esa extensión llama directamente a la API de GitHub fuera del alcance del proxy. El ahorro de tokens en VS Code Chat proviene de **RTK** + **codebase-memory-mcp**.

**Qué es Headroom**: proxy/compresor local que reduce tokens 60-95% en flujos CLI. Se planta entre el agente CLI y el LLM:

```
Agente CLI (Claude Code / Codex / gh copilot)
   ↓
Headroom proxy (opcional, localhost:8787)  ← comprime
   ↓
Modelo LLM responde
```

> Las tres capas (AOI bootstrap, Headroom, NVIDIA) son **independientes y componibles**.

**Forma de instalación (Phase 1.6 — opcional, con prompt)**: `setup.sh` / `setup.ps1` pregunta al operador. Si la instalación falla, el setup continúa sin Headroom.

```bash
# macOS / Linux
bash scripts/install-headroom.sh --yes
bash scripts/install-headroom.sh --dry-run      # preview sin instalar

# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-headroom.ps1 -Yes

# Helper envvars
bash scripts/headroom-vscode-setup.sh --emit-zsh        # snippet zsh
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/headroom-vscode-setup.ps1 -EmitPowerShell
```

**Modos de uso post-install**:

```bash
headroom proxy --port 8787                    # proxy OpenAI-compatible
headroom wrap copilot --subscription -- --model gpt-4o    # wrappear Copilot CLI
from headroom import compress                 # library Python
headroom mcp install                          # server MCP nativo
```

**AVISO IMPORTANTE — `headroom learn`**:

> ⚠️ `headroom learn --apply` puede escribir sobre `GEMINI.md`, `AGENTS.md`, `CLAUDE.md` (los 3 archivos AOI-managed raíz) sin awareness AOI.
>
> - **NO** se auto-corre desde el bootstrapper AOI.
> - **Recomendación**: usar `headroom learn --dry-run` primero, revisar el diff propuesto con `git diff`.
> - **Si hace cambios no aprobados**: `git checkout -- GEMINI.md AGENTS.md CLAUDE.md` los descarta.

**Relación con §5 NVIDIA**: ortogonales y combinables. Ambas opcionales con default seguro.

### §7 — Code Discovery Protocol (opcional, cuando `codebase-memory-mcp` está presente)

Si el workspace tiene registrado `codebase-memory-mcp` en `.vscode/mcp.json`, el agente **DEBE preferir sus graph tools** antes de explorar código con `grep`/lectura archivo por archivo.

Orden de preferencia:

1. `search_graph`
2. `trace_path`
3. `get_code_snippet`
4. `query_graph`
5. `get_architecture`
6. `search_code` o `grep` sólo para literales, configs, non-code files o fallback

Si el proyecto no está indexado todavía, correr `index_repository` primero. Si el servidor no está presente, volver al flujo normal de búsqueda local.

---

## Sources of Truth

| Resource               | Path                                    |
| ---------------------- | --------------------------------------- |
| Constitution           | `.specify/memory/constitution.md`       |
| Resources Constitution | `.resources/constitution.md`            |
| Dashboard Runtime      | `aoi_apps/agentic-ops-dashboard/`       |
| Export Bundles         | `.exportsmemories/`                     |
| Task Registry          | `.tasks/registry.md`                    |
| Skill Registry         | `.atl/skill-registry.md`                |
| Sandbox Registry       | `.sandboxes/registry.md`                |
| ICM Protocol           | `.agent/skills/_shared/icm-protocol.md` |
| Task Artifacts         | `.tasks/{feature}/TASK-YYYY-NNN/`       |
| Sandbox Config         | `.sandboxes/{name}/config.md`           |
| Install Config         | `.conf/manifest.json`                   |
| Install Checksums      | `.conf/checksums.json`                  |
| Install History        | `.conf/history.jsonl`                   |

## Task Structure

```
.tasks/
├── registry.md
├── {feature-name}/
│   ├── feature.md
│   └── TASK-YYYY-NNN/
│       ├── context.md, proposal.md, requirement.md, spec.md
│       ├── design.md, tasks.md, implementation-plan.md
│       ├── relations.json
│       ├── iterations/
│       ├── verify-report.md, functional-docs.md, archive-report.md
```

## Dashboard Runtime

Managed workspace commands:

- `pnpm --dir aoi_apps/agentic-ops-dashboard dev`
- `pnpm --dir aoi_apps/agentic-ops-dashboard test`
- `pnpm --dir aoi_apps/agentic-ops-dashboard exec nuxt prepare`
- `pnpm --dir aoi_apps/agentic-ops-dashboard build`

Runtime boundaries:

- Reads `.tasks/registry.md`, task artifact directories, and optional
  `.resources/` content.
- Uses `.tasks/{feature}/TASK-YYYY-NNN/relations.json` as the canonical explicit
  relation record.
- Limits server-side writes to governed `.resources/` operations only.

## Key Rules

- ALWAYS use `{WORKSPACE}` prefix for ICM topics
- ALWAYS run Service Discovery before requirement.md
- `.resources/` is optional context; never auto-ingest it during task
  construction unless the Owner explicitly links resource paths
- `.resources/workflows/` stores interaction definitions, not executable
  commands or shell instructions
- Structural changes inside `.resources/` MUST go through
  `/new-resource-folder`, `/move-resource-folder`, or
  `/delete-resource-folder`
- Exported memory bundles MUST stay inside `.exportsmemories/`
- Bundle imports NEVER auto-activate; they prepare candidates first and still
  require explicit Owner approval before activation
- NEVER auto-archive — Owner decides (flexible archive gate)
- NEVER skip ICM operations
- Consolidate topics at 7+ entries
- Transcripts ONLY in Explore (/sdd-new) and Archive (/sdd-archive) phases
