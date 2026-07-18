# Multi-Provider Customendpoint Setup — AOI

Este directorio contiene artefactos para configurar los providers directos
(DeepSeek, Zai, Alibaba, MiniMax, Kimi) con NVIDIA como fallback universal
en VS Code como **custom endpoints** para el catálogo AOI.

> ⚠️ **OPCIONAL**. AOI funciona perfectamente sin este setup. Si NO se configura,
> los modelos que se usarán son los defaults declarados en cada plataforma
> (`DeepSeek V4 Pro` / `GLM 5.2`). El catálogo multi-provider queda inerte
> hasta que el operador active los custom endpoints.

## Archivos

| Archivo                          | Estado       | Función                                                                                                 |
| :------------------------------- | :----------- | :------------------------------------------------------------------------------------------------------ |
| `ChatLanguageModel.example.json` | **tracked**  | Plantilla con `apiKey` placeholders. **NO contiene secrets reales.**                                    |
| `ChatLanguageModel.json`         | **ignorado** | (si lo creás localmente con tus API keys reales, debe estar en `.gitignore` del downstream / scaffold). |

## Proveedores configurados

| Provider | Modelo               | Uso en agentes                            |
| :------- | :------------------- | :---------------------------------------- |
| DeepSeek | DeepSeek V4 Pro      | 22 agentes (análisis, docs, orquestación) |
| Zai      | GLM 5.2              | 8 agentes (código, terminal, git)         |
| Alibaba  | Qwen 3.7 Plus        | 2 agentes (arquitectura, triage)          |
| MiniMax  | MiniMax M3           | 1 agente (UX/visual)                      |
| NVIDIA   | Todos los anteriores | Fallback universal cross-provider         |
| Kimi     | Kimi K2.6            | 0 agentes (sin caso de uso)               |

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
> | Plataforma | Path canónico                              | Forma expandida alternativa (Windows)                            |
> | :--------- | :----------------------------------------- | :--------------------------------------------------------------- |
> | macOS      | `~/Library/Application Support/Code/User/` | —                                                                |
> | Linux      | `~/.config/Code/User/`                     | —                                                                |
> | Windows    | `%APPDATA%\Code\User\`                     | `%APPDATA%\Roaming\Code\User\` (≡ mismo dir en 99% de los casos) |
>
> El script PowerShell prueba **ambas formas** y resuelve a la primera que exista (mismo patrón fallback que `aoi_apps/agentic-ops-dashboard/server/utils/token-observability/collect-copilot-token-usage.ts`).

### 3. Reiniciá VS Code

Tras reiniciar, los modelos configurados aparecerán en el picker de GitHub Copilot Chat.

### 4. Seleccioná manualmente por agente

Para cada agente que invocás, elegí el modelo en el picker (ver
`## Model Requirement` en cada `.agent.md`):

- `@supervisor`, `@functional-analyst`, `@integration-specialist`,
  `@documentation-analyst`, `@resource-analyst`,
  `@project-analyzer`, `@project-expert` → DeepSeek V4 Pro (DeepSeek)
- `@frontend-developer`, `@backend-developer`, `@devops-engineer` → GLM 5.2 (Zai)
- `@solution-architect`, `@triage-specialist` → Qwen 3.7 Plus (Alibaba)
- `@ux-designer` → MiniMax M3 (MiniMax)

## Forma automática

`setup.sh` (macOS/Linux) y `setup.ps1` (Windows) ejecutan un sub-paso opcional
después de instalar `rtk` + `icm`:

```text
▸ Custom endpoints (opcional)
  Detectar VS Code User dir + copiar plantilla + recordatorio de reemplazar API keys.
```

Si el operador responde `n`, AOI continúa con defaults vendor-copilot sin
bloquearse.

## Seguridad

> 🔐 **NUNCA** commitees el archivo `ChatLanguageModel.json` con tu API key real.
> El `.gitignore` de scaffold y la convención de tracked-only-example están
> diseñados para que un commit accidental NO leak-ee el secret.
