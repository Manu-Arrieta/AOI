# Model Selection Protocol

**OBLIGATORIO PARA TODOS LOS AGENTES:**

Para garantizar la mayor eficiencia y capacidad resolutiva de la infraestructura agéntica, la selección de modelos debe obedecer estrictamente las siguientes reglas, tanto en **Copilot** como en **Antigravity**.

## 1. Agentes de Razonamiento Abstracto

Para tareas que requieren pensamiento profundo, planificación, arquitectura, toma de decisiones o análisis complejo funcional (e.g. `supervisor`, `solution-architect`, `functional-analyst`, UX/Design):

- **Modelo por defecto:** `Gemini 3.1 Pro (Preview)`

## 2. Agentes de Implementación

Para tareas que requieren escribir código, ejecutar comandos en terminal, implementar lógica de negocio, configuración estricta, refactorización (e.g. `frontend-developer`, `backend-developer`, `devops-engineer`, `integration-specialist`):

- **Modelo por defecto:** `GPT-5.4 xhigh`

## 3. Fallback (Contingencia)

Si el modelo designado para el perfil del agente **no se encuentra disponible** o la plataforma no permite su acceso instantáneo:

1. **Detener la operación.**
2. **Notificar de inmediato al usuario** sobre la indisponibilidad del modelo.
3. No hacer una elección en su lugar. **Dejar al libre albedrío y decisión del usuario** indicar el modelo secundario a utilizar o cómo proceder.

## 4. Modelos Externos Recomendados (NVIDIA — Copilot Picker)

Para escenarios donde se requiere capacidad técnica especializada (código agéntico, razonamiento STEM denso, multimodalidad, Agent Swarm), se configuran custom endpoints NVIDIA disponibles en el picker de VS Code Copilot. **Ninguna regla de los apartados 1–3 queda invalidada** por este anexo: la selección sigue siendo decisión del operador.

> ⚠️ **Limitación Copilot**: El campo `model:` en el frontmatter de `.agent.md` solo resuelve modelos del vendor `copilot`. Los IDs NVIDIA listados abajo son `customendpoint` y **NO** se asignan automáticamente — el operador debe seleccionarlos manualmente en el picker antes de invocar al agente.

### Modelos Disponibles

| Modelo          | ID NVIDIA                     | Contexto | Output Max | Fortaleza                           |
| :-------------- | :---------------------------- | :------- | :--------- | :---------------------------------- |
| Kimi K2.6       | `moonshotai/kimi-k2.6`        | 256K     | 8,192      | Agent Swarm (orquestación)          |
| DeepSeek V4 Pro | `deepseek-ai/deepseek-v4-pro` | 1M       | 16,384     | Razonamiento STEM + contexto masivo |
| MiniMax M3      | `minimaxai/minimax-m3`        | 1M       | 8,192      | SWE-Bench Pro 59% + multimodal      |
| Qwen 3.5        | `qwen/qwen3.5-397b-a17b`      | 128K     | 16,384     | Visión nativa (respaldo UX)         |

### Asignación por Agente

| Agente                    | Modelo Primario     | Modelo de Respaldo |
| :------------------------ | :------------------ | :----------------- |
| `@supervisor`             | **Kimi K2.6**       | DeepSeek V4 Pro    |
| `@functional-analyst`     | **DeepSeek V4 Pro** | MiniMax M3         |
| `@solution-architect`     | **DeepSeek V4 Pro** | Kimi K2.6          |
| `@frontend-developer`     | **MiniMax M3**      | Kimi K2.6          |
| `@backend-developer`      | **DeepSeek V4 Pro** | MiniMax M3         |
| `@devops-engineer`        | **MiniMax M3**      | DeepSeek V4 Pro    |
| `@ux-designer`            | **MiniMax M3**      | Qwen 3.5           |
| `@integration-specialist` | **DeepSeek V4 Pro** | MiniMax M3         |
| `@documentation-analyst`  | **DeepSeek V4 Pro** | MiniMax M3         |
| `@triage-specialist`      | **DeepSeek V4 Pro** | Kimi K2.6          |
| `@resource-analyst`       | **DeepSeek V4 Pro** | MiniMax M3         |
| `@project-analyzer`       | **DeepSeek V4 Pro** | MiniMax M3         |
| `@project-expert`         | **DeepSeek V4 Pro** | MiniMax M3         |

### Distribución

- **DeepSeek V4 Pro**: 9 agentes (workhorse del ciclo SDD)
- **MiniMax M3**: 3 agentes (coding agéntico + multimodalidad)
- **Kimi K2.6**: 1 agente (orquestación multi-agente)
- **Qwen 3.5**: 0 primarios, respaldo UX

### Regla de selección manual (CRÍTICA — refuerzo de la regla §3)

> Cuando el operador seleccione un agente, **debe** abrir el picker de modelos y elegir el `Primary` configurado. Si el `Primary` no está disponible en el picker, **debe** elegir el `Fallback`. **Si ambos están ausentes** o el operador no completa la selección antes de la invocación, se aplica la regla §3: detener y notificar.

Esta jerarquía NO automatiza la selección: el AOI nunca elige modelo por cuenta propia.

### Mirror Obligatorio

> Toda asignación de agente declarada en este capítulo debe espejarse en `.agent/skills/agents/*.md` (Antigravity) con un bloque `## Model Requirement` equivalente. El protocolo `dual-sync.instructions.md` aplica sin excepciones.

## 5. Configuración del customendpoint NVIDIA (paso previo, opcional)

> ⚠️ **Si NO se configura**, AOI sigue funcionando con los defaults vendor-copilot declarados en §1–§2 (`Gemini 3.1 Pro (Preview)` y `GPT-5.4 xhigh` en raíz). El catálogo del §4 simplemente no se activa. Esta sección habilita el catálogo cuando el operador quiere usar los modelos especializados.

### 5.1 Prerrequisitos

1. **API key NVIDIA** activa — registrarla en `https://integrate.api.nvidia.com/`.
2. **VS Code** corriendo, con permisos de escritura sobre su `User/` dir.

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
    "name": "NVIDIA",
    "vendor": "customendpoint",
    "apiType": "chat-completions",
    "apiKey": "TU-API-KEY-NVIDIA-AQUÍ",
    "models": [
      {
        "id": "minimaxai/minimax-m3",
        "name": "Minimax M3",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 1000000,
        "maxOutputTokens": 8192
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
        "id": "moonshotai/kimi-k2.6",
        "name": "Kimi K2.6",
        "url": "https://integrate.api.nvidia.com/v1",
        "toolCalling": true,
        "streaming": true,
        "thinking": true,
        "vision": true,
        "maxInputTokens": 256000,
        "maxOutputTokens": 8192
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

## 6. Capa opcional de compresión — Headroom (headroomlabs-ai/headroom)

> ⚠️ **Si NO se activa, AOI sigue funcionando con defaults vendor-copilot** (`Gemini 3.1 Pro (Preview)` y `GPT-5.4 xhigh`). Esta sección habilita una capa **adicional y ortogonal** de compresión de contexto cuando el operador quiere reducir tokens 60-95%.

### 6.1 ¿Qué es Headroom y cómo se relaciona con AOI?

Headroom es **un proxy/compresor/MCP local** que se planta entre el agente y el LLM. Hace a **3 niveles** lo que RTK hace a nivel shell:

| Capa                      | Aporte                                            | Cómo se relaciona con AOI                                                                                                                                            |
| ------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell token-opt           | `rtk` (shipping AOI)                              | RTK está dentro de Headroom (Headroom incluye RTK como dependencia y comprime todo lo downstream de RTK)                                                             |
| Governancia / spec-driven | AOI bootstrapper (RTK + ICM + Spec-Kit + agentes) | AOI provee la infraestructura agentic; Headroom es una herramienta opcional de la que AOI se beneficia                                                               |
| Context compression       | **Headroom**                                      | AOI bootstrapper lo instala opcionalmente (Phase 1.6) pero **NO** lo activa por default — el operador decide cuándo corre `headroom proxy` o `headroom wrap copilot` |

> Headroom **NO** es competidor de AOI. Es ortogonal: AOI bootstrap, Headroom optimiza tokens.

### 6.2 Fase 1.6 (opcional) en setup

Al instalar AOI por primera vez via `setup.sh` (macOS/Linux) o `setup.ps1` (Windows), una nueva **Phase 1.6** pregunta al operador si quiere instalar Headroom:

```text
═══ Phase 1.6: Headroom compression layer (opcional) ═══

▸ Headroom (headroomlabs-ai/headroom) provee compresión proxy/MCP/library
   para reducir 60-95% tokens. Es CAPA OPCIONAL encima de AOI bootstrapper.
   NO se auto-activa.
▸ Si no se instala, AOI continúa funcionando exactamente igual.
▸ ¿Instalar Headroom pip package? [y/N]:
```

Si el operador responde `y`:

1. `scripts/install-headroom.sh` (o `.ps1` en Windows) detecta el package manager preferido (precedencia AOI: `uv` → `pipx` → `pip`).
2. Instala `headroom-ai[all]` (o extras específicas).
3. Si falla el install, AOI continúa con `warn` no-bloqueante (Headroom es opcional).
4. `scripts/headroom-vscode-setup.sh` (o `.ps1`) imprime un plan de envvars al operador. **NO** modifica archivos del operador (`~/.zshrc`, `~/.bashrc`, `$PROFILE`) ni VS Code — esos son deciciones del operador.

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

| Aspecto                   | §5 NVIDIA                                                       | §6 Headroom                                              |
| ------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| Activación                | VS Code picker manual                                           | Operador debe invocar `headroom proxy` / `headroom wrap` |
| Archivo tocado            | `~/.config/Code/User/ChatLanguageModel.json` (VS Code User dir) | Solo envvars (operador)                                  |
| Configuration persistence | Una vez aplicado, persiste en VS Code                           | Operador decide si persiste en shell rc / $PROFILE       |
| Default si NO se activa   | AOI sigue funcionando con defaults vendor-copilot               | AOI sigue funcionando con defaults vendor-copilot        |
| Compatibilidad            | Vendor `copilot` (nativo VS Code)                               | Custom local-first (no toca VS Code)                     |

> **§5 y §6 son ORTOGONALES**: el operador puede activar cualquiera, ambas, o ninguna. Ambas son opcionales y tienen default seguro (sistema sigue funcionando si no se aplican).

### 6.7 Compatibilidad del modelo mental entre capas

AOI bootstrapper ya tiene **13 agentes** con bloques `## Model Requirement` que asignan `Primary` + `Fallback` por NVIDIA custom endpoint (K2.6, DeepSeek V4 Pro, MiniMax M3, Qwen 3.5). Headroom comprime el contexto **antes** de que el provider asignado vía NVIDIA reciba la request. Por lo tanto:

```
Output de agente AOI
    ↓
Headroom proxy (opcional) comprime tokens
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
