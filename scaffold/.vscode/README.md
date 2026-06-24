# NVIDIA Customendpoint Setup — AOI

Este directorio contiene artefactos para configurar el endpoint NVIDIA
(`https://integrate.api.nvidia.com/v1`) en VS Code como **custom endpoint** para
los modelos externos recomendados del catálogo AOI (Kimi K2.6, DeepSeek V4 Pro,
MiniMax M3, Qwen 3.5).

> ⚠️ **OPCIONAL**. AOI funciona perfectamente sin este setup. Si NO se configura,
> los modelos que se usarán son los defaults declarados en cada plataforma
> (raíz: `Gemini 3.1 Pro (Preview)` / `GPT-5.4 xhigh`; Antigravity: `Claude Opus 4.6`
> / `GPT-5.4 xhigh`). El catálogo NVIDIA queda inerte hasta que el operador active
> el custom endpoint.

## Archivos

| Archivo                           | Estado    | Función                                                                                                     |
| :-------------------------------- | :-------- | :----------------------------------------------------------------------------------------------------------- |
| `ChatLanguageModel.example.json`  | **tracked** | Plantilla con `apiKey` placeholder `APIKEY-CONFIGURADA-PREVIAMENTE`. **NO contiene secret real.**         |
| `ChatLanguageModel.json`          | **ignorado** | (si lo creás localmente con tu API key real, debe estar en `.gitignore` del downstream / scaffold).     |

## Pasos para activarlo (una vez, en tu máquina)

### 1. Reemplazá la API key

Editá `ChatLanguageModel.example.json` localmente y reemplazá
`APIKEY-CONFIGURADA-PREVIAMENTE` por tu API key real de NVIDIA.

### 2. Renombrá el archivo y copialo

**macOS**:

```bash
mkdir -p "$HOME/Library/Application Support/Code/User"
cp .vscode/ChatLanguageModel.example.json "$HOME/Library/Application Support/Code/User/ChatLanguageModel.json"
sed -i '' 's/APIKEY-CONFIGURADA-PREVIAMENTE/<tu-api-key-real>/' "$HOME/Library/Application Support/Code/User/ChatLanguageModel.json"
```

**Linux**:

```bash
mkdir -p "$HOME/.config/Code/User"
cp .vscode/ChatLanguageModel.example.json "$HOME/.config/Code/User/ChatLanguageModel.json"
sed -i 's/APIKEY-CONFIGURADA-PREVIAMENTE/<tu-api-key-real>/' "$HOME/.config/Code/User/ChatLanguageModel.json"
```

**Windows (PowerShell) — forma corta (`$env:APPDATA\Code\User`)**:

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Code\User"
Copy-Item .vscode/ChatLanguageModel.example.json "$env:APPDATA\Code\User\ChatLanguageModel.json"
(Get-Content "$env:APPDATA\Code\User\ChatLanguageModel.json") -replace 'APIKEY-CONFIGURADA-PREVIAMENTE','<tu-api-key-real>' | Set-Content "$env:APPDATA\Code\User\ChatLanguageModel.json"
```

**Windows (PowerShell) — forma expandida (`$env:APPDATA\Roaming\Code\User`)**:

Ambas formas son **equivalentes** en máquinas donde `$env:APPDATA` resuelve correctamente (apuntan al mismo directorio físico `C:\Users\<usuario>\AppData\Roaming\Code\User\`). La forma expandida es útil en instalaciones standalone / portable o cuando se sigue un link de docs que escribe `\Roaming\` explícitamente:

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Roaming\Code\User"
Copy-Item .vscode/ChatLanguageModel.example.json "$env:APPDATA\Roaming\Code\User\ChatLanguageModel.json"
(Get-Content "$env:APPDATA\Roaming\Code\User\ChatLanguageModel.json") -replace 'APIKEY-CONFIGURADA-PREVIAMENTE','<tu-api-key-real>' | Set-Content "$env:APPDATA\Roaming\Code\User\ChatLanguageModel.json"
```

> 📍 **Resumen de VS Code User dir por plataforma** (el script helper `nvidia-vscode-setup.{sh,ps1}` resuelve automáticamente probando todas las alternativas):
>
> | Plataforma | Path canónico                                     | Forma expandida alternativa (Windows)                                |
> | :--------- | :------------------------------------------------ | :------------------------------------------------------------------- |
> | macOS      | `~/Library/Application Support/Code/User/`        | —                                                                   |
> | Linux      | `~/.config/Code/User/`                            | —                                                                   |
> | Windows    | `%APPDATA%\Code\User\`                            | `%APPDATA%\Roaming\Code\User\` (≡ mismo dir en 99% de los casos)     |
>
> El script PowerShell prueba **ambas formas** y resuelve a la primera que exista (mismo patrón fallback que `aoi_apps/agentic-ops-dashboard/server/utils/token-observability/collect-copilot-token-usage.ts`).

### 3. Reiniciá VS Code

Tras reiniciar, los 4 modelos NVIDIA aparecerán en el picker de GitHub Copilot Chat.

### 4. Seleccioná manualmente por agente

Para cada agente que invocás, elegí el modelo en el picker (ver
`## Model Requirement` en cada `.agent.md`):

- `@supervisor` → Kimi K2.6
- `@solution-architect`, `@functional-analyst`, `@integration-specialist`,
  `@documentation-analyst`, `@triage-specialist`, `@resource-analyst`,
  `@project-analyzer`, `@project-expert` → DeepSeek V4 Pro
- `@backend-developer` → DeepSeek V4 Pro (default), MiniMax M3 fallback
- `@frontend-developer`, `@devops-engineer`, `@ux-designer` → MiniMax M3

## Forma automática

`setup.sh` (macOS/Linux) y `setup.ps1` (Windows) ejecutan un sub-paso opcional
después de instalar `rtk` + `icm`:

```text
▸ NVIDIA customendpoint (opcional)
  Detectar VS Code User dir + copiar plantilla + recordatorio de reemplazar API key.
```

Si el operador responde `n`, AOI continúa con defaults vendor-copilot sin
bloquearse.

## Seguridad

> 🔐 **NUNCA** commitees el archivo `ChatLanguageModel.json` con tu API key real.
> El `.gitignore` de scaffold y la convención de tracked-only-example están
> diseñados para que un commit accidental NO leak-ee el secret.
