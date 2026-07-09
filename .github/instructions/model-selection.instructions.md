# Model Selection Protocol

**OBLIGATORIO PARA TODOS LOS AGENTES:**

Para garantizar la mayor eficiencia y capacidad resolutiva de la infraestructura agéntica, la selección de modelos debe obedecer estrictamente las siguientes reglas, tanto en **Copilot** como en **Antigravity**.

## 1. Agentes de Razonamiento Abstracto

Para tareas que requieren pensamiento profundo, planificación, arquitectura, toma de decisiones o análisis complejo funcional (e.g. `supervisor`, `solution-architect`, `functional-analyst`, `triage-specialist`, `resource-analyst`, `integration-specialist`, `documentation-analyst`, `project-analyzer`, `project-expert`, UX/Design):

- **Modelo por defecto:** `DeepSeek V4 Pro`

## 2. Agentes de Implementación

Para tareas que requieren escribir código, ejecutar comandos en terminal, implementar lógica de negocio, configuración estricta, refactorización (e.g. `frontend-developer`, `backend-developer`, `devops-engineer`):

- **Modelo por defecto:** `GLM-5.2`

## 3. Regla de Preeminencia (CRÍTICA)

> Cuando un agente declara un bloque `## Model Requirement` en su archivo `.agent.md` (Copilot) o `.agent/skills/agents/*.md` (Antigravity), la asignación documentada en ese bloque **reemplaza** el default genérico de las categorías §1 y §2. Si el bloque `## Model Requirement` del agente especifica un `Primary` + `Fallback`, esa jerarquía es la fuente de verdad para ESE agente.
>
> **El operador DEBE seleccionar el modelo `Primary` en el picker de la plataforma antes de invocar al agente.** Los modelos custom no se asignan automáticamente via frontmatter ni via parámetros de `runSubagent`. Si el `Primary` no está disponible, el operador DEBE elegir el `Fallback` manualmente.

## 4. Mecanismo `runSubagent` (Copilot)

Al invocar un agente via `runSubagent`, el caller DEBE pasar el parámetro `model` con el valor exacto del `Primary` declarado en el `## Model Requirement` del agente destino:

```ts
// Agentes de razonamiento con Model Requirement específico
runSubagent({ agentName: "supervisor", model: "Kimi K2.7 Code OR", ... })
runSubagent({ agentName: "solution-architect", model: "Qwen 3.7 OR", ... })
runSubagent({ agentName: "triage-specialist", model: "Qwen 3.7 OR", ... })

// Agentes de razonamiento que usan el default (DeepSeek V4 Pro)
runSubagent({ agentName: "functional-analyst", model: "DeepSeek V4 Pro", ... })
runSubagent({ agentName: "integration-specialist", model: "DeepSeek V4 Pro", ... })

// Agentes de implementación
runSubagent({ agentName: "backend-developer", model: "GLM-5.2", ... })
runSubagent({ agentName: "frontend-developer", model: "GLM-5.2", ... })
runSubagent({ agentName: "devops-engineer", model: "GLM-5.2", ... })
```

## 5. Asignación por Agente (tabla canónica)

| Agente | Primary | OpenRouter ID | Fallback | NVIDIA ID | Categoría |
|---|---|---|---|---|---|
| `supervisor` | `Kimi K2.7 Code OR` | `moonshotai/kimi-k2.7-code` | `Kimi K2.6` | `moonshotai/kimi-k2.6` | Razonamiento |
| `solution-architect` | `Qwen 3.7 OR` | `qwen/qwen3.7-max` | `Qwen 3.5` | `qwen/qwen3.5-397b-a17b` | Razonamiento |
| `functional-analyst` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `triage-specialist` | `Qwen 3.7 OR` | `qwen/qwen3.7-max` | `Qwen 3.5` | `qwen/qwen3.5-397b-a17b` | Razonamiento |
| `integration-specialist` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `documentation-analyst` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `project-analyzer` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `project-expert` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `resource-analyst` | `DeepSeek V4 Pro OR` | `deepseek/deepseek-v4-pro` | `DeepSeek V4 Pro` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `ux-designer` | `Minimax M3 OR` | `minimax/minimax-m3` | `Minimax M3` | `minimaxai/minimax-m3` | Razonamiento |
| `frontend-developer` | `GLM 5.2 OR` | `z-ai/glm-5.2` | `GLM 5.2` | `z-ai/glm-5.2` | Implementación |
| `backend-developer` | `GLM 5.2 OR` | `z-ai/glm-5.2` | `GLM 5.2` | `z-ai/glm-5.2` | Implementación |
| `devops-engineer` | `GLM 5.2 OR` | `z-ai/glm-5.2` | `GLM 5.2` | `z-ai/glm-5.2` | Implementación |

## 6. Fallback (Contingencia)

Si el modelo designado para el perfil del agente **no se encuentra disponible** o la plataforma no permite su acceso instantáneo:

1. **Detener la operación.**
2. **Notificar de inmediato al usuario** sobre la indisponibilidad del modelo.
3. No hacer una elección en su lugar. **Dejar al libre albedrío y decisión del usuario** indicar el modelo secundario a utilizar o cómo proceder.

> Esta regla aplica incluso cuando existe un jerarquía de `Primary` + `Fallback` configurada para el agente: AOI **nunca** elige un modelo alternativo por cuenta propia. La jerarquía de respaldo sólo describe un orden sugerido para la decisión humana.

## 7. Mirror Obligatorio (Dual-Sync)

> Toda actualización de esta tabla canónica debe espejarse en `.agent/skills/_shared/model-selection.md` (Antigravity). El protocolo `dual-sync.instructions.md` aplica sin excepciones. Ambos archivos deben mantenerse idénticos en su sección normativa y tabla de asignación.
| Qwen 3.7 Max    | `qwen/qwen3.7-max`            | 1M       | 65,536     | Extended Thinking nativo, GPQA Diamond 92.4% — agent-first | ✅ Líder razonamiento |
| Kimi K2.7 Code  | `moonshotai/kimi-k2.7-code`   | 256K     | 16,384     | Agent Swarm nativo, 30% menos tokens vs K2.6, MoonViT multimodal | ✅ Líder orquestación |
| MiniMax M3      | `minimax/minimax-m3`          | 1M       | 8,192      | Visión multimodal nativa (imagen+video), BrowseComp 83.5 | ✅ Líder UX/visual |

> 📊 **Fuente**: Benchmark interno 7 modelos × 3 tests AOI SDD (Functional Analyst, Backend Developer, Triage Specialist) — Julio 2026. Ver `.exportsmemories/` o `/Users/equinox/Desktop/nvidia-bench/reports/`.

### Asignación por Agente (Mid-2026)

> ⚡ **Criterio actualizado**: Asignación basada en análisis consolidado cruzando evaluaciones de Gemini, Grok, GPT y Claude Opus contra benchmarks reales (SWE-Bench Pro/Verified, Terminal-Bench, GPQA Diamond). Ver `Benchmark/model-reference/consolidated-recommendation.md`.

| Agente                    | Modelo Primario      | Modelo de Respaldo  | Criterio de asignación |
| :------------------------ | :------------------- | :------------------ | :--------------------- |
| `@supervisor`             | **Kimi K2.7 Code**   | DeepSeek V4 Pro     | Agent Swarm nativo + 30% token savings para orquestación Hub-and-Spoke |
| `@functional-analyst`     | **DeepSeek V4 Pro**  | Qwen 3.7 Max        | 49B activos + 1M contexto para specs masivas y Service Discovery |
| `@solution-architect`     | **Qwen 3.7 Max**     | DeepSeek V4 Pro     | Extended Thinking + GPQA 92.4% para trade-offs arquitectónicos |
| `@frontend-developer`     | **GLM 5.2**          | MiniMax M3          | Terminal-Bench 81.0 + SWE-Bench Pro 62.1% — líder open-weight |
| `@backend-developer`      | **GLM 5.2**          | DeepSeek V4 Pro     | SWE-Bench Pro 62.1% + 1M contexto nativo (IndexShare) |
| `@devops-engineer`        | **GLM 5.2**          | MiniMax M3          | Terminal-Bench 81.0 para CLI, scripts e IaC |
| `@ux-designer`            | **MiniMax M3**       | Qwen 3.7 Max        | Visión multimodal nativa para mockups y accesibilidad |
| `@integration-specialist` | **DeepSeek V4 Pro**  | Qwen 3.7 Max        | Auditoría cruzada spec→código con 1M de contexto |
| `@documentation-analyst`  | **DeepSeek V4 Pro**  | Qwen 3.7 Max        | 1M contexto para absorber ciclo SDD completo |
| `@triage-specialist`      | **Qwen 3.7 Max**     | DeepSeek V4 Pro     | Extended Thinking para Root Cause Analysis profundo |
| `@resource-analyst`       | **DeepSeek V4 Pro**  | GLM 5.2             | Procesamiento masivo de .resources/ (49B + 1M) |
| `@project-analyzer`       | **DeepSeek V4 Pro**  | MiniMax M3          | Escaneo exhaustivo de repos con citación precisa |
| `@project-expert`         | **DeepSeek V4 Pro**  | GLM 5.2             | Retención contextual profunda + citación de fuentes |

### Distribución (Mid-2026)

- **DeepSeek V4 Pro**: 6 agentes (análisis, auditoría, documentación — contexto masivo 1M + 49B activos)
- **GLM 5.2**: 3 agentes (frontend, backend, devops — ejecución de código + terminal)
- **Qwen 3.7 Max**: 2 agentes (arquitectura, triage — Extended Thinking)
- **Kimi K2.7 Code**: 1 agente (supervisor — orquestación Agent Swarm)
- **MiniMax M3**: 1 agente (UX — visión multimodal nativa)

### Modelos Descartados del Catálogo Activo

| Modelo | Razón | Estado |
| :----- | :---- | :----- |
| Nemotron Ultra | Tool calling falla incluso con `tool_choice:"required"` — inutilizable para agentes AOI | ❌ Excluido |
| DeepSeek V4 Flash | ResourceExhausted constante (rate limit del endpoint) — no evaluable | ❌ Excluido (re-test pendiente) |

### Regla de selección manual (CRÍTICA — refuerzo de la regla §3)

> Cuando el operador seleccione un agente, **debe** abrir el picker de modelos y elegir el `Primary` configurado. Si el `Primary` no está disponible en el picker, **debe** elegir el `Fallback`. **Si ambos están ausentes** o el operador no completa la selección antes de la invocación, se aplica la regla §3: detener y notificar.

Esta jerarquía NO automatiza la selección: el AOI nunca elige modelo por cuenta propia.

### Mirror Obligatorio

> Toda asignación de agente declarada en este capítulo debe espejarse en `.agent/skills/agents/*.md` (Antigravity) con un bloque `## Model Requirement` equivalente. El protocolo `dual-sync.instructions.md` aplica sin excepciones.

## 5. Configuración Dual OpenRouter + NVIDIA (paso previo, opcional)

> ⚠️ **Si NO se configura**, AOI sigue funcionando con los defaults vendor-copilot declarados en §1–§2 (`DeepSeek V4 Pro` y `GLM-5.2` en raíz). El catálogo del §4 simplemente no se activa. Esta sección habilita el catálogo dual cuando el operador quiere usar los modelos especializados.

### 5.1 Prerrequisitos

1. **API key OpenRouter** activa — registrarla en `https://openrouter.ai/keys`.
2. **API key NVIDIA** activa — registrarla en `https://integrate.api.nvidia.com/`.
3. **VS Code** corriendo, con permisos de escritura sobre su `User/` dir.

### 5.2 Ubicaciones del VS Code User dir

| Plataforma | Path canónico                              | Path expandido (Windows alternativa)                             |
| :--------- | :----------------------------------------- | :--------------------------------------------------------------- |
| macOS      | `~/Library/Application Support/Code/User/` | —                                                                |
| Linux      | `~/.config/Code/User/`                     | —                                                                |
| Windows    | `%APPDATA%\Code\User\`                     | `%APPDATA%\Roaming\Code\User\` (≡ mismo dir en 99% de los casos) |

> ⚠️ **Por qué dos formas Windows**: En Windows, `${env:APPDATA}` normalmente **es** `C:\Users\<usuario>\AppData\Roaming\`, así que `%APPDATA%\Code\User\` y `%APPDATA%\Roaming\Code\User\` apuntan al mismo directorio. Sin embargo, en **instalaciones standalone / portable** o cuando una URL/link de docs usa la forma con `\Roaming\` explícita, conviene usar la forma expandida. El script `scripts/nvidia-vscode-setup.ps1` prueba **ambas** (más `$env:LOCALAPPDATA\Code\User` como último fallback) y resuelve a la primera que exista, replicando el patrón de `scaffold/aoi_apps/agentic-ops-dashboard/server/utils/token-observability/collect-copilot-token-usage.ts`.

### 5.3 Formato del archivo `ChatLanguageModel.json`

VS Code espera un **array JSON** con un único vendor `customendpoint`:

```json
[
  {
    "name": "OpenRouter",
    "vendor": "customendpoint",
    "apiKey": "${input:chat.lm.secret.-5cf42978}",
    "apiType": "chat-completions",
    "models": [
      {
        "id": "z-ai/glm-5.2",
        "name": "GLM 5.2 OR",
        "url": "https://openrouter.ai/api/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384
      },
      {
        "id": "deepseek/deepseek-v4-pro",
        "name": "DeepSeek V4 Pro OR",
        "url": "https://openrouter.ai/api/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384
      },
      {
        "id": "qwen/qwen3.7-max",
        "name": "Qwen 3.7 OR",
        "url": "https://openrouter.ai/api/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 128000,
        "maxOutputTokens": 16384
      },
      {
        "id": "moonshotai/kimi-k2.7-code",
        "name": "Kimi K2.7 Code OR",
        "url": "https://openrouter.ai/api/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 256000,
        "maxOutputTokens": 16384
      },
      {
        "id": "minimax/minimax-m3",
        "name": "Minimax M3 OR",
        "url": "https://openrouter.ai/api/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384           
      }
    ]
  },
  {
    "name": "NVIDIA",
    "vendor": "customendpoint",
    "apiKey": "${input:chat.lm.secret.46ff130f}",
    "apiType": "chat-completions",
    "models": [
      {
        "id": "z-ai/glm-5.2",
        "name": "GLM 5.2",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384
      },
      {
        "id": "deepseek-ai/deepseek-v4-pro",
        "name": "DeepSeek V4 Pro",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384
      },
      {
        "id": "qwen/qwen3.5-397b-a17b",
        "name": "Qwen 3.5",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 128000,
        "maxOutputTokens": 16384
      },
      {
        "id": "moonshotai/kimi-k2.6",
        "name": "Kimi K2.6",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 256000,
        "maxOutputTokens": 16384
      },
      {
        "id": "minimaxai/minimax-m3",
        "name": "Minimax M3",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 16384
      }
    ]
  }
]
```

> 📋 **Plantilla canónica**: `scaffold/.vscode/ChatLanguageModel.example.json`. El archivo real con secret **NO** debe versionarse (ver §5.5).

### 5.4 Forma automatizada (recomendado)

Durante la **Phase 1.5 (opcional)** de `setup.sh` o `setup.ps1`, AOI ofrece copiar la plantilla al User dir del operador:

```bash
# macOS / Linux (incluido en setup.sh)
bash scripts/nvidia-vscode-setup.sh
bash scripts/nvidia-vscode-setup.sh --yes --key <TU-API-KEY>

# Windows (incluido en setup.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nvidia-vscode-setup.ps1 -Yes -ApiKey <TU-API-KEY>
```

El operador aún debe:

1. Confirmar la copia (`Y/n`).
2. Reemplazar el placeholder `APIKEY-CONFIGURADA-PREVIAMENTE` por el API key real (si no lo hizo via `--key`/`-ApiKey`).
3. Reiniciar VS Code para que los modelos aparezcan en el picker.

### 5.5 Forma manual

```bash
# macOS
mkdir -p "$HOME/Library/Application Support/Code/User"
cp scaffold/.vscode/ChatLanguageModel.example.json \
   "$HOME/Library/Application Support/Code/User/ChatLanguageModel.json"
$EDITOR "$HOME/Library/Application Support/Code/User/ChatLanguageModel.json"
# reemplazá APIKEY-CONFIGURADA-PREVIAMENTE por tu API key real

# Linux
mkdir -p "$HOME/.config/Code/User"
cp scaffold/.vscode/ChatLanguageModel.example.json \
   "$HOME/.config/Code/User/ChatLanguageModel.json"
$EDITOR "$HOME/.config/Code/User/ChatLanguageModel.json"

# Windows (PowerShell) — forma corta
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Code\User"
Copy-Item scaffold/.vscode/ChatLanguageModel.example.json "$env:APPDATA\Code\User\ChatLanguageModel.json"
notepad "$env:APPDATA\Code\User\ChatLanguageModel.json"

# Windows (PowerShell) — forma expandida (`$env:APPDATA\Roaming\Code\User\`)
# Equivalente a la forma corta en máquinas donde APPDATA resuelve correctamente.
# Útil cuando $env:APPDATA no responde como se espera o se sigue un link que
# usa la forma explícita con \Roaming\.
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Roaming\Code\User"
Copy-Item scaffold/.vscode/ChatLanguageModel.example.json "$env:APPDATA\Roaming\Code\User\ChatLanguageModel.json"
notepad "$env:APPDATA\Roaming\Code\User\ChatLanguageModel.json"
```

### 5.6 Seguridad

> 🔐 **NUNCA** commitear el archivo `ChatLanguageModel.json` con API key real. AOI versiona solo `.example.json` vía `scaffold/.vscode/ChatLanguageModel.example.json`. El `.gitignore` excluye la keyfile real en ambas rutas (raíz y scaffold). El script `nvidia-vscode-setup.{sh,ps1}` escribe directo al User dir del operador, evitando contaminar el repo.

### 5.7 Regla de selección manual (CRÍTICA — refuerzo de §3)

Tras configurar el customendpoint:

- El operador **DEBE** elegir manualmente en el picker el `Primary` (o `Fallback`) deseado **antes** de invocar al agente.
- El campo `model:` del frontmatter **NO** puede autoasignar modelos NVIDIA. Por lo tanto, la regla §3 ("Detener y notificar") se aplica si el picker no contiene el modelo configurado para el agente.

## 6. Capa obligatoria de compresión — Headroom (headroomlabs-ai/headroom)

> ✅ **Default AOI**: Headroom es una capa **OBLIGATORIA** del bootstrapper. La Phase 1.6 de `setup.sh` / `setup.ps1` corre sin prompt y aborta el setup si la instalación no se completa. Esta sección documenta cómo opera, no se decide.

### 6.1 ¿Qué es Headroom y cómo se relaciona con AOI?

Headroom es **un proxy/compresor/MCP local** que se planta entre el agente y el LLM. Hace a **3 niveles** lo que RTK hace a nivel shell:

| Capa                      | Aporte                                            | Cómo se relaciona con AOI                                                                                     |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shell token-opt           | `rtk` (shipping AOI)                              | RTK está dentro de Headroom (Headroom incluye RTK como dependencia y comprime todo lo downstream de RTK)      |
| Governancia / spec-driven | AOI bootstrapper (RTK + ICM + Spec-Kit + agentes) | AOI provee la infraestructura agentic; Headroom es una herramienta obligatoria de la que AOI se provee        |
| Context compression       | **Headroom**                                      | AOI bootstrapper instala Headroom de forma bloqueante en Phase 1.6. Si la instalación falla, el setup aborta. |

> Headroom **NO** es competidor de AOI. Es ortogonal: AOI bootstrap, Headroom optimiza tokens.

### 6.2 Fase 1.6 (obligatoria, bloqueante) en setup

Al instalar AOI por primera vez via `setup.sh` (macOS/Linux) o `setup.ps1` (Windows), una **Phase 1.6** ejecuta la instalación de Headroom sin prompts:

```text
═══ Phase 1.6: Headroom compression layer (obligatorio) ═══

▸ Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library
   para reducir 60-95% tokens. Es CAPA OBLIGATORIA de AOI bootstrapper.
   AOI requiere Headroom. Si la instalación falla, el setup aborta.
```

1. `scripts/install-headroom.sh` (o `.ps1` en Windows) detecta el package manager preferido (precedencia AOI: `uv` → `pipx` → `pip`).
2. Instala `headroom-ai[all]` (o extras específicas).
3. Si el install falla, el setup **aborta** (Headroom es obligatorio).
4. `scripts/headroom-vscode-setup.sh` (o `.ps1`) imprime el plan de envvars. **NO** modifica archivos del operador (`~/.zshrc`, `~/.bashrc`, `$PROFILE`) ni VS Code — esos son del operador.

### 6.3 Modos de uso (post-install)

| Modo             | Comando                                                  | Función                                                                                                                         |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Proxy server** | `headroom proxy --port 8787`                             | Proxy OpenAI-compatible en localhost. Compatible con cualquier cliente OpenAI-compatible (Cortex Code, Aider, scripts propios). |
| **Wrap agent**   | `headroom wrap copilot --subscription -- --model gpt-4o` | Wrappea GitHub Copilot CLI; intercambia token OAuth headroom-specific por el short-lived token de Copilot.                      |
| **Library**      | `from headroom import compress`                          | Inline en apps Python/TS existentes.                                                                                            |
| **MCP**          | `headroom mcp install`                                   | Expone `headroom_compress` / `headroom_retrieve` / `headroom_stats` a cualquier cliente MCP.                                    |

Modos adicionales soportados oficialmente: `claude`, `codex`, `cursor`, `aider`, `openclaw`, `opencode`. Cubre TODOS los coding agents mainstream.

### 6.4 Variables de entorno relevantes

| Var                                     | Default     | Función                                                                                                                                                |
| --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HEADROOM_HOST`                         | `127.0.0.1` | Dirección donde escucha el proxy                                                                                                                       |
| `HEADROOM_PORT` / `HEADROOM_PROXY_PORT` | `8787`      | Puerto del proxy                                                                                                                                       |
| `GITHUB_COPILOT_TOKEN`                  | (Keychain)  | Token GitHub para `headroom wrap copilot`. Auth-reuse funciona en macOS Keychain; Windows Credential Manager / Linux Secret Service aún en validación. |
| `GITHUB_COPILOT_ENTERPRISE_DOMAIN`      | (vacío)     | Override para GitHub Enterprise Server                                                                                                                 |
| `HEADROOM_UPDATE_CHECK`                 | (on)        | `off` desactiva el aviso de update al arrancar proxy                                                                                                   |
| `HEADROOM_OUTPUT_SHAPER`                | `0`         | `1` activa verbosity steering + effort routing (output token reduction ~31.7%)                                                                         |
| `HEADROOM_OUTPUT_HOLDOUT`               | `0`         | `0.1` deja 10% de conversaciones unshaped como control group para medición                                                                             |
| `HEADROOM_TLS_STRICT`                   | `on`        | `0` desactiva verificación `VERIFY_X509_STRICT` (útil en redes con SSL inspection Zscaler)                                                             |
| `HEADROOM_CONTEXT_TOOL`                 | `rtk`       | Alternativas: `lean-ctx` (CLI context tool alternativo)                                                                                                |

Persistencia de envvars: el operador decide. El helper `headroom-vscode-setup.sh` puede emitir snippet para `~/.zshrc` / `~/.bashrc` via flags `--emit-bash` / `--emit-zsh`. **Nunca** auto-modifica shell rc.

### 6.5 ⚠️ Capa de riesgo: `headroom learn` y archivos AOI-managed

> Este es el **único footprint** que Headroom tiene sobre la superficie de archivos AOI. Requiere disciplina del operador.

Headroom provee el comando `headroom learn`, que **mina sesiones pasadas de IA y escribe correcciones automáticas** a archivos de instrucciones del workspace. Documentación oficial dice:

> `headroom learn` — mines failed sessions, writes corrections to `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`.

AOI **exactly tracks** los tres archivos en la raíz del repo (`GEMINI.md`, `AGENTS.md`, `CLAUDE.md`). Si el operador corre `headroom learn --apply` durante una sesión AOI activa, Headroom podría machucar secciones AOI-managed **sin awareness AOI**.

**Política AOI**:

1. **NO** se auto-corre `headroom learn` desde el bootstrapper.
2. **NO** se bloquea su ejecución — es decisión del operador.
3. **SÍ** se imprime warning al instalar Headroom, recordando el riesgo y los archivos afectados.
4. **Recomendación operativa**:
   - Pre-correr `git diff --stat` antes de `headroom learn --apply`
   - Usar `headroom learn --dry-run` (variante `--verbosity` lo soporta nativamente) para revisar el diff propuesto
   - Post-correr `git checkout -- GEMINI.md AGENTS.md CLAUDE.md` para descartar cambios no aprobados manualmente
5. **Mitigaciones futuras posibles** (no implementadas en v0):
   - Marcas `# aoi:managed-begin` / `# aoi:managed-end` en archivos AOI-managed y un git hook que rechace cambios fuera de esos bloques
   - Constitution `policy.md` que registre "archivos AOI-managed no son editables por headroom learn sin aprobación"

### 6.6 Diferencias con respecto a §5 (NVIDIA customendpoint)

| Aspecto                   | §5 NVIDIA                                                       | §6 Headroom                                                                          |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Activación                | VS Code picker manual                                           | AOI setup bloqueante (Phase 1.6); operador decide `headroom proxy` / `headroom wrap` |
| Archivo tocado            | `~/.config/Code/User/ChatLanguageModel.json` (VS Code User dir) | Solo envvars (operador)                                                              |
| Configuration persistence | Una vez aplicado, persiste en VS Code                           | Operador decide si persiste en shell rc / $PROFILE                                   |
| Default si NO se activa   | AOI sigue funcionando con defaults vendor-copilot               | Setup aborta; AOI requiere Headroom operativo                                        |
| Compatibilidad            | Vendor `copilot` (nativo VS Code)                               | Custom local-first (no toca VS Code)                                                 |

> **§5 es opcional; §6 es obligatorio**. §5 (NVIDIA) la decide el operador; §6 (Headroom) la decide el bootstrapper. Ambas coexistentes sin conflicto.

### 6.7 Fase 1.7 (obligatoria) — Integración AOI ↔ Headroom

Para que la obligatoriedad sea real y no solo a nivel de instalación, el setup añade **Phase 1.7** que instala dos activos críticos:

| Activo                            | Ruta                                 | Función                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aoi-headroom-wrap.sh` (+ `.ps1`) | `scripts/aoi-headroom-wrap.{sh,ps1}` | Wrapper que rechaza invocaciones si `headroom` falta en PATH y reejecuta `headroom wrap copilot --subscription`. Es el único punto de invocación de Copilot CLI permitido por la política AOI.                                |
| `aoi-copilot` shim                | `scripts/bin/aoi-copilot`            | Shim binario que enruta cualquier llamada estilo "copilot" hacia el wrapper. SDD agents usan este shim en lugar del comando nativo.                                                                                           |
| `pre-commit-aoi-guard.sh`         | `.githooks/pre-commit-aoi-guard.sh`  | Pre-commit hook que **bloquea** cualquier cambio en `GEMINI.md`, `AGENTS.md` o `CLAUDE.md` sin el marker `[aoi-managed-ok]`. Impide que `headroom learn --apply` (u otra herramienta externa) pise la superficie AOI-managed. |

**Reglas para SDD agents**:

1. **Nunca** invocar `copilot` directamente — siempre vía `bash scripts/aoi-headroom-wrap.sh` (o PowerShell `.ps1`). El shim `aoi-copilot` es azucar sintáctico.
2. **Nunca** ejecutar `headroom learn --apply` en sesiones AOI activas. Si el operador lo hace contra su propio repo, el pre-commit guard lo aborta.
3. **Operación normal**: `bash scripts/aoi-headroom-wrap.sh --model gpt-4o "" "Tu prompt"`. Envía vía `headroom wrap copilot --subscription --model gpt-4o "" "Tu prompt"`.

**Aviso a Operador**: el guard puede sobreescribirse con `bash .githooks/pre-commit-aoi-guard.sh --force` (rechazado por convención). Si necesitás validar diff sobre AOI-managed, agregá `[aoi-managed-ok]` al subject del commit después de revisar manualmente.

### 6.7 Compatibilidad del modelo mental entre capas

AOI bootstrapper ya tiene **13 agentes** con bloques `## Model Requirement` que asignan `Primary` + `Fallback` por NVIDIA custom endpoint (Kimi K2.7 Code, DeepSeek V4 Pro, GLM-5.2, Qwen 3.7 Max, MiniMax M3). Headroom comprime el contexto **antes** de que el provider asignado vía NVIDIA reciba la request. Por lo tanto:

```
Output de agente AOI
    ↓
Headroom proxy (obligatorio) comprime tokens

## 7. Protocolo de descubrimiento de código — codebase-memory-mcp (opcional)

> ✅ **Si está instalado**, `codebase-memory-mcp` es la vía preferida para exploración estructural de código. AOI lo registra sólo a nivel workspace en `.vscode/mcp.json`; no debe auto-configurar archivos globales del operador.

### 7.1 Qué problema resuelve

Cuando el agente explora el codebase archivo por archivo (`grep` + `read` repetidos), el costo de tokens y tool-calls sube innecesariamente. `codebase-memory-mcp` indexa el repo en un knowledge graph local y responde preguntas estructurales con menos contexto.

### 7.2 Cuándo usarlo primero

Si el servidor MCP `codebase-memory-mcp` está disponible en el workspace, el agente **DEBE preferirlo** para:

1. Encontrar funciones, clases, routes o symbols por patrón
2. Trazar quién llama a una función o qué llama esa función
3. Pedir un resumen de arquitectura o hotspots del repo
4. Hacer queries estructurales donde `grep` sería ruidoso

### 7.3 Orden de preferencia

1. `search_graph` — ubicar funciones, clases, routes, variables por patrón
2. `trace_path` — seguir call chains inbound/outbound
3. `get_code_snippet` — leer el source exacto del symbol ya encontrado
4. `query_graph` — consultas Cypher complejas
5. `get_architecture` — overview del codebase
6. `search_code` o `grep` — sólo para literales, mensajes, configs o fallback

### 7.4 Cuándo NO alcanza y hay que volver a grep/read

`grep` / lectura directa siguen siendo correctos para:

- string literals
- mensajes de error
- archivos no código o config
- casos donde el índice todavía no existe o está desactualizado

### 7.5 Regla operativa

Si el repo aún no fue indexado, el primer paso es `index_repository`. Si `codebase-memory-mcp` no está presente en `.vscode/mcp.json`, esta sección no aplica y el agente vuelve al flujo normal de búsqueda local.
    ↓
NVIDIA custom endpoint (opcional) entrega al modelo elegido
    ↓
Modelo responde
```

AOI **no interfiere** con Headroom y Headroom **no interfiere** con NVIDIA. Las tres capas son componibles independientemente.

### 6.8 Documentación externa

- **Instalación headroom Python**: `pip install "headroom-ai[all]"` — extras granulares: `[proxy]`, `[mcp]`, `[ml]` (Kompress-base), `[code]`, `[memory]`, `[relevance]`, `[image]`, `[agno]`, `[langchain]`, `[evals]`, `[pytorch-mps]`
- **Documentación oficial**: https://headroom-docs.vercel.app/docs
- **Comando actualizaciones**: `headroom update` detecta pip/pipx/uv tool y upgrade in-place
- **Repo upstream**: https://github.com/headroomlabs-ai/headroom
- **Versión de la regla §3**: incluso con Headroom + NVIDIA configurados, **AOI NUNCA elige modelo por sí solo**. El operador decide siempre vía pickers o envvars.
