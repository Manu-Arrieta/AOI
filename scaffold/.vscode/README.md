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

### 2. Identificá el destino correcto (perfil VS Code)

VS Code puede usar **perfiles** que reubican la configuración de modelos. Si tu
workspace tiene un perfil asignado, el archivo destino es:

```
<User dir>/profiles/<profile-id>/chatLanguageModels.json
```

Si el workspace usa el perfil por defecto (`__default__profile__`), el destino es:

```
<User dir>/ChatLanguageModel.json
```

Para saber cuál aplica, revisá `globalStorage/storage.json` dentro del User dir.
El script `nvidia-vscode-setup.{sh,ps1}` **detecta el perfil automáticamente** y
escribe en la ubicación correcta.

### 3. Copiá el archivo al destino

**Forma automática (recomendado)**:

```bash
bash scripts/nvidia-vscode-setup.sh --yes --key <TU-API-KEY>
```

El script detecta el perfil y escribe en `profiles/<id>/chatLanguageModels.json`
si aplica, o en `ChatLanguageModel.json` de la raíz en caso contrario.

**Forma manual — sin perfil (default profile)**:

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

**Windows (PowerShell)**:

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Code\User"
Copy-Item .vscode/ChatLanguageModel.example.json "$env:APPDATA\Code\User\ChatLanguageModel.json"
(Get-Content "$env:APPDATA\Code\User\ChatLanguageModel.json") -replace 'APIKEY-CONFIGURADA-PREVIAMENTE','<tu-api-key-real>' | Set-Content "$env:APPDATA\Code\User\ChatLanguageModel.json"
```

**Forma manual — con perfil activo**:

Reemplazá `<profile-id>` por el ID de tu perfil (ej. `-5f85a270`):

**macOS**:

```bash
PROFILE_DIR="$HOME/Library/Application Support/Code/User/profiles/<profile-id>"
mkdir -p "$PROFILE_DIR"
cp .vscode/ChatLanguageModel.example.json "$PROFILE_DIR/chatLanguageModels.json"
sed -i '' 's/APIKEY-CONFIGURADA-PREVIAMENTE/<tu-api-key-real>/' "$PROFILE_DIR/chatLanguageModels.json"
```

**Linux**:

```bash
PROFILE_DIR="$HOME/.config/Code/User/profiles/<profile-id>"
mkdir -p "$PROFILE_DIR"
cp .vscode/ChatLanguageModel.example.json "$PROFILE_DIR/chatLanguageModels.json"
sed -i 's/APIKEY-CONFIGURADA-PREVIAMENTE/<tu-api-key-real>/' "$PROFILE_DIR/chatLanguageModels.json"
```

> 📍 **Resumen de VS Code User dir por plataforma**:
>
> | Plataforma | Path canónico                              |
> | :--------- | :----------------------------------------- |
> | macOS      | `~/Library/Application Support/Code/User/` |
> | Linux      | `~/.config/Code/User/`                     |
> | Windows    | `%APPDATA%\Code\User\`                     |
>
> El script `nvidia-vscode-setup.{sh,ps1}` resuelve todo automáticamente (User dir,
> perfil activo, y destino correcto).

### 4. Reiniciá VS Code

Tras reiniciar, los modelos aparecerán en el picker de GitHub Copilot Chat agrupados
por provider (NVIDIA, Alibaba, MiniMax, DeepSeek, Kimi, etc.).

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
  Detectar VS Code User dir + perfil activo + copiar plantilla en la ubicación
  correcta (root o profiles/<id>/chatLanguageModels.json) + recordatorio de
  reemplazar API keys.
```

El script **detecta automáticamente el perfil VS Code** desde `storage.json`.
Si el workspace está asociado a un perfil (ej. `-5f85a270`), escribe en
`profiles/<id>/chatLanguageModels.json`. Si usa el perfil por defecto, escribe
en `ChatLanguageModel.json` de la raíz.

Si el operador responde `n`, AOI continúa con defaults vendor-copilot sin
bloquearse.

## Seguridad

> 🔐 **NUNCA** commitees el archivo `ChatLanguageModel.json` con tu API key real.
> El `.gitignore` de scaffold y la convención de tracked-only-example están
> diseñados para que un commit accidental NO leak-ee el secret.
