---
name: "Model Selection Protocol"
description: "Mandatory model selection rules for all AOI agents. Covers reasoning agents, implementation agents, multi-provider config, and NVIDIA fallback."
applyTo: "**"
---

# Model Selection Protocol

**OBLIGATORIO PARA TODOS LOS AGENTES:**

Para garantizar la mayor eficiencia y capacidad resolutiva de la infraestructura agéntica, la selección de modelos debe obedecer estrictamente las siguientes reglas en **Copilot**.

## 1. Agentes de Razonamiento Abstracto

Para tareas que requieren pensamiento profundo, planificación, arquitectura, toma de decisiones o análisis complejo funcional (e.g. `supervisor`, `solution-architect`, `functional-analyst`, `triage-specialist`, `resource-analyst`, `integration-specialist`, `documentation-analyst`, `project-analyzer`, `project-expert`, UX/Design):

- **Modelo por defecto:** `DeepSeek V4 Pro`

## 2. Agentes de Implementación

Para tareas que requieren escribir código, ejecutar comandos en terminal, implementar lógica de negocio, configuración estricta, refactorización (e.g. `frontend-developer`, `backend-developer`, `devops-engineer`):

- **Modelo por defecto:** `GLM-5.2`

## 3. Regla de Preeminencia (CRÍTICA)

> Cuando un agente declara un bloque `## Model Requirement` en su archivo `.agent.md`, la asignación documentada en ese bloque **reemplaza** el default genérico de las categorías §1 y §2. Si el bloque `## Model Requirement` del agente especifica un `Primary` + `Fallback`, esa jerarquía es la fuente de verdad para ESE agente.
>
> **El operador DEBE seleccionar el modelo `Primary` en el picker de la plataforma antes de invocar al agente.** Los modelos custom no se asignan automáticamente via frontmatter ni via parámetros de `runSubagent`. Si el `Primary` no está disponible, el operador DEBE elegir el `Fallback` manualmente.

## 4. Modelos Externos Recomendados (Multi-Provider Directo + NVIDIA Fallback)

### 4.0 Mecanismo `runSubagent` (Copilot)

Al invocar un agente via `runSubagent`, el caller DEBE pasar el parámetro `model` con el valor del `name` del modelo en el picker de Copilot, documentado en el `## Model Requirement` del agente destino:

```ts
// Ejemplos — consultar ## Model Requirement de cada agente para el valor exacto
runSubagent({ agentName: "functional-analyst", model: "Deepseek v4 pro - Provider - Deepseek", ... })
runSubagent({ agentName: "frontend-developer", model: "Glm5.2 - Provider - Zai", ... })
runSubagent({ agentName: "solution-architect", model: "Qwen 3.7 plus - Provider - Alibaba", ... })
runSubagent({ agentName: "ux-designer", model: "Minimax M3 - Provider - Minimax", ... })
```

> El modelo exacto que se pasa a `runSubagent` es el `name` que aparece en el picker de Copilot (`Deepseek v4 pro - Provider - Deepseek (customendpoint)`, `Glm5.2 - Provider - Zai (customendpoint)`, etc.). Los agentes documentan el **API-level ID** en su `## Model Requirement` (ej. `deepseek-v4-pro`). Para saber qué valor pasar a `runSubagent`, consultá la columna `runSubagent model` en el Agent Registry de `agent-delegation.instructions.md` o usá el nombre exacto tal cual aparece en el picker de VS Code.

### 4.1 Modelos Disponibles

> ⚡ **Estrategia Multi-Provider**: Cada modelo usa su provider nativo como primario (DeepSeek → api.deepseek.com, GLM 5.2 → api.z.ai, Qwen 3.7 → Alibaba Cloud, MiniMax M3 → api.minimax.io). NVIDIA actúa como fallback universal para todos los modelos, garantizando redundancia cross-provider sin intermediarios.

| Modelo          | ID Primario                  | ID Fallback (NVIDIA)          | Fortaleza                                                                   |
| :-------------- | :--------------------------- | :---------------------------- | :-------------------------------------------------------------------------- |
| DeepSeek V4 Pro | `deepseek-v4-pro` (DeepSeek) | `deepseek-ai/deepseek-v4-pro` | 1M contexto + 49B activos + SWE-Bench Verified 80.6% — razonamiento general |
| GLM 5.2         | `glm-5.2` (Zai)              | `z-ai/glm-5.2`                | Terminal-Bench 81.0 + SWE-Bench Pro 62.1% — líder código/terminal           |
| Qwen 3.7 Plus   | `qwen3.7-plus` (Alibaba)     | `deepseek-v4-pro` (DeepSeek)  | Extended Thinking + 1M contexto — razonamiento profundo                     |
| MiniMax M3      | `MiniMax-M3` (MiniMax)       | `minimaxai/minimax-m3`        | Visión multimodal nativa — líder UX/visual                                  |

> 📊 **Fuente**: Benchmark interno 7 modelos × 3 tests AOI SDD (Functional Analyst, Backend Developer, Triage Specialist) — Julio 2026. Ver `.exportsmemories/` o `/Users/equinox/Desktop/nvidia-bench/reports/`.

### Asignación por Agente (Julio 2026)

> ⚡ **Criterio actualizado**: Asignación basada en providers directos disponibles en `ChatLanguageModel.example.json`. Fallback universal vía NVIDIA. Kimi K2.6 descartado por no tener caso de uso que DeepSeek V4 Pro o GLM 5.2 no cubran mejor.

| Agente                    | Modelo Primario     | Provider | Modelo de Respaldo | Provider | Criterio                                                                 |
| :------------------------ | :------------------ | :------- | :----------------- | :------- | :----------------------------------------------------------------------- |
| `@supervisor`             | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | 1M contexto para orquestación del ciclo SDD completo                     |
| `@functional-analyst`     | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | 49B activos + 1M contexto para specs masivas y Service Discovery         |
| `@solution-architect`     | **Qwen 3.7 Plus**   | Alibaba  | DeepSeek V4 Pro    | DeepSeek | Extended Thinking para trade-offs arquitectónicos. Fallback cross-modelo |
| `@frontend-developer`     | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   | Terminal-Bench 81.0 + SWE-Bench Pro 62.1%. Redundancia cross-provider    |
| `@backend-developer`      | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   | SWE-Bench Pro 62.1% + 1M contexto. Redundancia cross-provider            |
| `@devops-engineer`        | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   | Terminal-Bench 81.0 para CLI, scripts e IaC. Redundancia cross-provider  |
| `@ux-designer`            | **MiniMax M3**      | MiniMax  | MiniMax M3         | NVIDIA   | Visión multimodal nativa insuperable. Redundancia cross-provider         |
| `@integration-specialist` | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | Auditoría cruzada spec→código con 1M de contexto                         |
| `@documentation-analyst`  | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | 1M contexto para absorber ciclo SDD completo                             |
| `@triage-specialist`      | **Qwen 3.7 Plus**   | Alibaba  | DeepSeek V4 Pro    | DeepSeek | Extended Thinking para RCA profundo. Fallback cross-modelo               |
| `@resource-analyst`       | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | Procesamiento masivo de .resources/ (49B + 1M)                           |
| `@project-analyzer`       | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | Escaneo exhaustivo de repos con citación precisa                         |
| `@project-expert`         | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   | Retención contextual profunda + citación de fuentes                      |

### Agentes Speckit

| Agente                   | Modelo Primario     | Provider | Modelo de Respaldo | Provider |
| :----------------------- | :------------------ | :------- | :----------------- | :------- |
| `speckit.constitution`   | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.specify`        | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.clarify`        | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.plan`           | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.tasks`          | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.analyze`        | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.checklist`      | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.taskstoissues`  | **DeepSeek V4 Pro** | DeepSeek | DeepSeek V4 Pro    | NVIDIA   |
| `speckit.implement`      | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |
| `speckit.git.initialize` | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |
| `speckit.git.validate`   | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |
| `speckit.git.commit`     | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |
| `speckit.git.remote`     | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |
| `speckit.git.feature`    | **GLM 5.2**         | Zai      | GLM 5.2            | NVIDIA   |

### Distribución (Julio 2026)

- **DeepSeek V4 Pro**: 22 agentes (7 dominio + 8 speckit reasoning — 1M contexto + 49B activos)
- **GLM 5.2**: 9 agentes (3 dominio implementación + 1 speckit.implement + 5 speckit.git — Terminal-Bench 81.0)
- **Qwen 3.7 Plus**: 2 agentes (solution-architect + triage-specialist — Extended Thinking)
- **MiniMax M3**: 1 agente (ux-designer — visión multimodal nativa)
- **Kimi K2.6**: 0 agentes (sin caso de uso — DeepSeek V4 Pro lo supera en todo)

### Modelos Descartados del Catálogo Activo

| Modelo            | Razón                                                                                   | Estado                          |
| :---------------- | :-------------------------------------------------------------------------------------- | :------------------------------ |
| Nemotron Ultra    | Tool calling falla incluso con `tool_choice:"required"` — inutilizable para agentes AOI | ❌ Excluido                     |
| DeepSeek V4 Flash | ResourceExhausted constante (rate limit del endpoint) — no evaluable                    | ❌ Excluido (re-test pendiente) |

### Regla de selección manual (CRÍTICA — refuerzo de la regla §3)

> Cuando el operador seleccione un agente, **debe** abrir el picker de modelos y elegir el `Primary` configurado. Si el `Primary` no está disponible en el picker, **debe** elegir el `Fallback`. **Si ambos están ausentes** o el operador no completa la selección antes de la invocación, se aplica la regla §3: detener y notificar.

Esta jerarquía NO automatiza la selección: el AOI nunca elige modelo por cuenta propia.

## 5. Configuración Multi-Provider + NVIDIA Fallback (paso previo, opcional)

> ⚠️ **Si NO se configura**, AOI sigue funcionando con los defaults vendor-copilot declarados en §1–§2 (`DeepSeek V4 Pro` y `GLM-5.2` en raíz). El catálogo del §4 simplemente no se activa. Esta sección habilita el catálogo multi-provider cuando el operador quiere usar los modelos especializados con redundancia cross-provider.

### 5.1 Prerrequisitos

1. **API keys de providers directos** activas:
   - DeepSeek: `https://platform.deepseek.com/api_keys`
   - Zai (GLM 5.2): `https://open.bigmodel.cn/usercenter/apikeys`
   - Alibaba (Qwen): `https://bailian.console.aliyun.com/`
   - MiniMax: `https://platform.minimax.io/user-center/basic-information/interface-key`
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

> 📋 **Plantilla canónica**: `scaffold/.vscode/ChatLanguageModel.example.json` — este archivo contiene la configuración completa multi-provider (NVIDIA, Alibaba, MiniMax, DeepSeek, Kimi, Zai) con 6 vendors `customendpoint`. El archivo real con API keys **NO** debe versionarse.

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

> `headroom learn` — mines failed sessions, writes corrections to `CLAUDE.md` / `AGENTS.md`.

AOI **exactly tracks** los dos archivos en la raíz del repo (`AGENTS.md`, `CLAUDE.md`). Si el operador corre `headroom learn --apply` durante una sesión AOI activa, Headroom podría machucar secciones AOI-managed **sin awareness AOI**.

**Política AOI**:

1. **NO** se auto-corre `headroom learn` desde el bootstrapper.
2. **NO** se bloquea su ejecución — es decisión del operador.
3. **SÍ** se imprime warning al instalar Headroom, recordando el riesgo y los archivos afectados.
4. **Recomendación operativa**:
   - Pre-correr `git diff --stat` antes de `headroom learn --apply`
   - Usar `headroom learn --dry-run` (variante `--verbosity` lo soporta nativamente) para revisar el diff propuesto
   - Post-correr `git checkout -- AGENTS.md CLAUDE.md` para descartar cambios no aprobados manualmente
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

| Activo                            | Ruta                                 | Función                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aoi-headroom-wrap.sh` (+ `.ps1`) | `scripts/aoi-headroom-wrap.{sh,ps1}` | Wrapper que rechaza invocaciones si `headroom` falta en PATH y reejecuta `headroom wrap copilot --subscription`. Es el único punto de invocación de Copilot CLI permitido por la política AOI.                   |
| `aoi-copilot` shim                | `scripts/bin/aoi-copilot`            | Shim binario que enruta cualquier llamada estilo "copilot" hacia el wrapper. SDD agents usan este shim en lugar del comando nativo.                                                                              |
| `pre-commit-aoi-guard.sh`         | `.githooks/pre-commit-aoi-guard.sh`  | Pre-commit hook que **bloquea** cualquier cambio en `AGENTS.md` o `CLAUDE.md` sin el marker `[aoi-managed-ok]`. Impide que `headroom learn --apply` (u otra herramienta externa) pise la superficie AOI-managed. |

**Reglas para SDD agents**:

1. **Nunca** invocar `copilot` directamente — siempre vía `bash scripts/aoi-headroom-wrap.sh` (o PowerShell `.ps1`). El shim `aoi-copilot` es azucar sintáctico.
2. **Nunca** ejecutar `headroom learn --apply` en sesiones AOI activas. Si el operador lo hace contra su propio repo, el pre-commit guard lo aborta.
3. **Operación normal**: `bash scripts/aoi-headroom-wrap.sh --model gpt-4o "" "Tu prompt"`. Envía vía `headroom wrap copilot --subscription --model gpt-4o "" "Tu prompt"`.

**Aviso a Operador**: el guard puede sobreescribirse con `bash .githooks/pre-commit-aoi-guard.sh --force` (rechazado por convención). Si necesitás validar diff sobre AOI-managed, agregá `[aoi-managed-ok]` al subject del commit después de revisar manualmente.

### 6.7 Compatibilidad del modelo mental entre capas

AOI bootstrapper ya tiene **27 agentes** con bloques `## Model Requirement` que asignan `Primary` + `Fallback` por provider directo (DeepSeek V4 Pro, GLM 5.2 via Zai, Qwen 3.7 Plus via Alibaba, MiniMax M3) con NVIDIA como fallback universal. Headroom comprime el contexto **antes** de que el provider asignado reciba la request. Por lo tanto:

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
