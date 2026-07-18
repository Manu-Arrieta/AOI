# Model Selection Protocol

**OBLIGATORIO PARA TODOS LOS AGENTES:**

Para garantizar la mayor eficiencia y capacidad resolutiva de la infraestructura agéntica, la selección de modelos debe obedecer estrictamente las siguientes reglas, tanto en **Copilot** como en **Antigravity**.

## 1. Agentes de Razonamiento Abstracto

Para tareas de pensamiento profundo, planificación, arquitectura, toma de decisiones o análisis complejo funcional (e.g. `supervisor`, `solution-architect`, `functional-analyst`, `triage-specialist`, `resource-analyst`, `integration-specialist`, `documentation-analyst`, `project-analyzer`, `project-expert`, UX/Design):

- **Modelo por defecto:** `DeepSeek V4 Pro`

> Ver §4 de `.github/instructions/model-selection.instructions.md` para el catálogo multi-provider + NVIDIA fallback. La asignación concreta por agente está en el bloque `## Model Requirement` del agente específico (en `.github/agents/*.agent.md` y su mirror `.agent/skills/agents/*.md`).

## 2. Agentes de Implementación

Para tareas de escritura de código, ejecución de comandos, implementación de lógica de negocio, configuración estricta, refactorización (e.g. `frontend-developer`, `backend-developer`, `devops-engineer`):

- **Modelo por defecto:** `GLM 5.2`

> Misma regla de preeminencia: la asignación del `## Model Requirement` del agente prima sobre el default declarado arriba.

> Cuando un agente declara un bloque `## Model Requirement` en su archivo `.agent.md` (Copilot) o `.agent/skills/agents/*.md` (Antigravity), la asignación documentada en ese bloque **reemplaza** el default genérico de las categorías §1 y §2. Si el bloque `## Model Requirement` del agente especifica un `Primary` + `Fallback`, esa jerarquía es la fuente de verdad para ESE agente.
>
> **El operador DEBE seleccionar el modelo `Primary` en el picker de la plataforma antes de invocar al agente.** Los modelos custom no se asignan automáticamente via frontmatter ni via parámetros de `runSubagent`. Si el `Primary` no está disponible, el operador DEBE elegir el `Fallback` manualmente.

## 4. Asignación por Agente (tabla canónica — Julio 2026)

> 📊 **Fuente**: Basado en providers directos disponibles en `ChatLanguageModel.example.json`. Kimi K2.6 descartado.

| Agente                    | Primary           | Provider | Fallback                      | Provider | Categoría      |
| :------------------------ | :---------------- | :------- | :---------------------------- | :------- | :------------- |
| `@supervisor`             | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@functional-analyst`     | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@solution-architect`     | `qwen3.7-plus`    | Alibaba  | `deepseek-v4-pro`             | DeepSeek | Razonamiento   |
| `@triage-specialist`      | `qwen3.7-plus`    | Alibaba  | `deepseek-v4-pro`             | DeepSeek | Razonamiento   |
| `@integration-specialist` | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@documentation-analyst`  | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@project-analyzer`       | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@project-expert`         | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@resource-analyst`       | `deepseek-v4-pro` | DeepSeek | `deepseek-ai/deepseek-v4-pro` | NVIDIA   | Razonamiento   |
| `@ux-designer`            | `MiniMax-M3`      | MiniMax  | `minimaxai/minimax-m3`        | NVIDIA   | Razonamiento   |
| `@frontend-developer`     | `glm-5.2`         | Zai      | `z-ai/glm-5.2`                | NVIDIA   | Implementación |
| `@backend-developer`      | `glm-5.2`         | Zai      | `z-ai/glm-5.2`                | NVIDIA   | Implementación |
| `@devops-engineer`        | `glm-5.2`         | Zai      | `z-ai/glm-5.2`                | NVIDIA   | Implementación |

### Distribución

- **DeepSeek V4 Pro**: 22 agentes (7 dominio + 8 speckit reasoning + 7 speckit)
- **GLM 5.2**: 9 agentes (3 dominio + 5 speckit implementación/git) — Provider Zai, fallback NVIDIA
- **Qwen 3.7 Plus**: 2 agentes (solution-architect + triage-specialist) — Provider Alibaba, fallback DeepSeek
- **MiniMax M3**: 1 agente (ux-designer) — Provider MiniMax, fallback NVIDIA
- **Kimi K2.6**: 0 agentes — descartado

### Modelos Descartados

| Modelo            | Razón                                                                |
| :---------------- | :------------------------------------------------------------------- |
| Nemotron Ultra    | ❌ Tool calling falla incluso con `tool_choice:"required"`           |
| DeepSeek V4 Flash | ❌ ResourceExhausted constante — re-test pendiente                   |
| Kimi K2.6         | ❌ Sin K2.7, no tiene caso de uso que DeepSeek V4 Pro no cubra mejor |

## 5. Fallback (Contingencia)

Si el modelo designado para el perfil del agente **no se encuentra disponible** o la plataforma no permite su acceso instantáneo:

1. **Detener la operación.**
2. **Notificar de inmediato al usuario** sobre la indisponibilidad del modelo.
3. No hacer una elección en su lugar. **Dejar al libre albedrío y decisión del usuario** indicar el modelo secundario a utilizar o cómo proceder.

> Esta regla aplica incluso cuando existe un jerarquía de `Primary` + `Fallback` configurada para el agente: AOI **nunca** elige un modelo alternativo por cuenta propia. La jerarquía de respaldo sólo describe un orden sugerido para la decisión humana.

## 6. Mirror Obligatorio (Dual-Sync)

> La tabla canónica está en §4. Este archivo espeja `.github/instructions/model-selection.instructions.md` (raíz Copilot). El protocolo `dual-sync.instructions.md` aplica sin excepciones.

### Regla de selección manual (CRÍTICA — refuerzo de §5)

> Cuando el operador seleccione un agente, **debe** abrir el picker de modelos y elegir el `Primary` configurado en el bloque `## Model Requirement` del agente. Si el `Primary` no está disponible, **debe** elegir el `Fallback`. **Si ambos están ausentes** o el operador no completa la selección antes de la invocación, se aplica la regla §5: detener y notificar.

### Dual-Sync

> Toda asignación de agente declarada en el raíz debe espejarse en `.agent/skills/agents/*.md` (Antigravity) con un bloque `## Model Requirement` equivalente.

### Nota de Riesgo — Qwen 3.7 Plus (Alibaba Cloud)

> ⚠️ **Qwen 3.7 Plus** corre en Alibaba Cloud (MaaS). Disponibilidad y pricing pueden variar.
>
> **Mitigación**: Los agentes que usan Qwen 3.7 Plus como Primary (@solution-architect, @triage-specialist) tienen `DeepSeek V4 Pro` como Fallback cross-modelo (DeepSeek provider directo).

## 7. Customendpoint NVIDIA — Setup opcional (espejo del §5 raíz)

> ⚠️ **Si NO se configura**, AOI sigue funcionando con los defaults declarados en §1–§2 (`DeepSeek V4 Pro` y `GLM 5.2`). El catálogo multi-provider simplemente no se activa.

Este capítulo espeja el §5 de `.github/instructions/model-selection.instructions.md` (raíz Copilot). El detalle completo de:

- **Ubicaciones del VS Code User dir** (macOS / Linux / Windows; Windows con dos formas equivalentes `%APPDATA%\Code\User` y `%APPDATA%\Roaming\Code\User` — mismo directorio físico en 99% de los casos)
- **Formato del archivo** ``ChatLanguageModel.json` con los 4 modelos NVIDIA
- **Forma automatizada** vía `scripts/nvidia-vscode-setup.{sh,ps1}` durante Phase 1.5
- **Forma manual** de copia y reemplazo de API key
- **Reglas de seguridad** (gitignore excluye la keyfile real)

…vive en el raíz. Este archivo Antigravity **no lo redefine** — sólo lo referencia para mantener paridad. El operador siempre debe:

1. **Tener API key NVIDIA** activa (`https://integrate.api.nvidia.com/`).
2. **Copiar** `scaffold/.vscode/ChatLanguageModel.example.json` al VS Code User dir con `apiKey` reemplazado por la API key real.
3. **Reiniciar VS Code**.
4. **Elegir manualmente** en el picker el `Primary` (o `Fallback`) documentado en el bloque `## Model Requirement` del agente invocado.

Forma automatizada disponible:

```bash
# macOS / Linux
bash scripts/nvidia-vscode-setup.sh --dry-run           # preview
bash scripts/nvidia-vscode-setup.sh --yes --key <KEY>   # non-interactive

# Windows
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -DryRun
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -Yes -ApiKey <KEY>
```

La regla §3 (detener y notificar al Owner, NUNCA elegir por defecto) **siempre** tiene prioridad sobre la jerarquía `Primary`+`Fallback` — incluso después de configurar el customendpoint, AOI no elige modelo por sí solo.

## 8. Capa obligatoria de compresión — Headroom (espejo del §6 raíz)

> ✅ **Headroom es OBLIGATORIO** en AOI. La Phase 1.6 de `setup.sh` / `setup.ps1` corre sin prompt y bloquea el setup si la instalación no se completa. Complementa los defaults vendor-copilot con una capa adicional de compresión 60-95%.

Este capítulo espeja el §6 de `.github/instructions/model-selection.instructions.md` (raíz Copilot). El detalle completo de:

- **Qué es Headroom** vs AOI (AOI bootstrap, Headroom optimiza tokens — ortogonales)
- **Phase 1.6 (bloqueante) en setup**, sin prompt `Y/n`, install via `uv` → `pipx` → `pip`, dry-run support
- **Modos de uso**: `headroom proxy`, `headroom wrap copilot`, library, MCP
- **Variables de entorno**: `HEADROOM_HOST`, `HEADROOM_PORT`, `HEADROOM_PROXY_PORT`, `GITHUB_COPILOT_TOKEN`, `HEADROOM_OUTPUT_SHAPER`, `HEADROOM_TLS_STRICT`, etc.
- ⚠️ **Política `headroom learn` vs archivos AOI-managed**: warning instalado, NO auto-ejecución, mitigaciones futuras
- **Compatibility matrix** con §5 NVIDIA: §6 obligatoria, §5 opcional, default seguro sin config NVIDIA
- Compatibility con 13 agentes AOI (Pre-Headroom → Provider vía NVIDIA)

…vive en el raíz. Este archivo Antigravity **no lo redefine** — sólo lo referencia para mantener paridad.

### Política de rigor

La regla §3 (detener y notificar al Owner, NUNCA elegir por defecto) **siempre** tiene prioridad sobre cualquier configuración de Headroom + NVIDIA. AOI no elige modelo ni capa de compresión por sí solo — el operador decide cada activación manualmente.

## 9. Protocolo de descubrimiento de código — codebase-memory-mcp (espejo del §7 raíz)

> ✅ **Si está instalado**, `codebase-memory-mcp` pasa a ser la vía preferida para exploración estructural de código. AOI lo registra sólo a nivel workspace en `.vscode/mcp.json`; no debe auto-configurar archivos globales del operador.

Este capítulo espeja el §7 de `.github/instructions/model-selection.instructions.md` (raíz Copilot). La doctrina es:

1. **Preferir** `search_graph`, `trace_path`, `get_code_snippet`, `query_graph`, `get_architecture`
2. Usar `grep` / `read` directo sólo para literales, configs, non-code files o fallback
3. Si el repo no está indexado todavía, correr `index_repository` primero

Regla operativa: si `codebase-memory-mcp` no está disponible en el workspace, esta sección no aplica y el agente vuelve al flujo normal de búsqueda local.

### Mirror Obligatorio (general — aplica a TODA la doctrina)

> Todo bloque de doctrina declarado en el raíz (NVIDIA §5, Headroom §6, defaults §1-§2, fallback §3) debe espejarse en `.agent/skills/_shared/model-selection.md` (Antigravity) sin divergencia. El protocolo `dual-sync.instructions.md` aplica sin excepciones. Si encontrás drift entre este archivo y el raíz, abrí un issue con tag `dual-sync-drift` antes de continuar.

### Fuente

Catálogo basado en la [Recomendación Consolidada del Benchmark](../../Benchmark/model-reference/consolidated-recommendation.md), cruzando evaluaciones de Gemini, Grok y GPT con análisis propio de Claude Opus.
