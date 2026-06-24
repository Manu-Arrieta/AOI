# Model Selection Protocol

**OBLIGATORIO PARA TODOS LOS AGENTES:**

Para garantizar la mayor eficiencia y capacidad resolutiva de la infraestructura agéntica, la selección de modelos debe obedecer estrictamente las siguientes reglas, tanto en **Copilot** como en **Antigravity**.

## 1. Agentes de Razonamiento Abstracto

Para tareas que requieren pensamiento profundo, planificación, arquitectura, toma de decisiones o análisis complejo funcional (e.g. `supervisor`, `solution-architect`, `functional-analyst`, `triage-specialist`, `resource-analyst`, UX/Design):

- **Modelo por defecto:** `Gemini 3.1 Pro (Preview)` (raíz) / `Claude Opus 4.6` (Antigravity)

> Ver §4 de `.github/instructions/model-selection.instructions.md` para el catálogo NVIDIA customendpoint. Cuando se asignen modelos NVIDIA al agente desde el picker del operador, esta regla queda reemplazada por la asignación documentada en el bloque `## Model Requirement` del agente específico (en `.github/agents/*.agent.md` y su mirror `.agent/skills/agents/*.md`).

## 2. Agentes de Implementación

Para tareas que requieren escribir código, ejecutar comandos en terminal, implementar lógica de negocio, configuración estricta, refactorización (e.g. `frontend-developer`, `backend-developer`, `devops-engineer`, `integration-specialist`):

- **Modelo por defecto:** `GPT-5.4 xhigh`

> Misma regla de preeminencia: si el operador eligió un NVIDIA customendpoint en el picker, esa selección prima sobre el default declarado arriba.

## 3. Fallback (Contingencia)

Si el modelo designado para el perfil del agente **no se encuentra disponible** o la plataforma no permite su acceso instantáneo:

1. **Detener la operación.**
2. **Notificar de inmediato al usuario** sobre la indisponibilidad del modelo.
3. No hacer una elección en su lugar. **Dejar al libre albedrío y decisión del usuario** indicar el modelo secundario a utilizar o cómo proceder.

> Esta regla aplica incluso cuando existe un jerarquía de `Primary` + `Fallback` configurada para el agente: AOI **nunca** elige un modelo alternativo por cuenta propia. La jerarquía de respaldo sólo describe un orden sugerido para la decisión humana.

## 4. Modelos Externos Recomendados (Espejo del capítulo raíz)

Este capítulo espeja el §4 de `.github/instructions/model-selection.instructions.md` (raíz Copilot). El catálogo NVIDIA completo, la tabla de asignación por agente, la distribución y la regla de selección manual del operador vivem allí. Este archivo Antigravity **no redefine** el catálogo — sólo lo referencia para mantener paridad.

### Regla de selección manual (CRÍTICA — refuerzo de la regla §3)

> Cuando el operador seleccione un agente, **debe** abrir el picker de modelos y elegir el `Primary` configurado en el bloque `## Model Requirement` del agente. Si el `Primary` no está disponible, **debe** elegir el `Fallback`. **Si ambos están ausentes** o el operador no completa la selección antes de la invocación, se aplica la regla §3: detener y notificar.

### Mirror Obligatorio

> Toda asignación de agente declarada en el capítulo raíz debe espejarse en `.agent/skills/agents/*.md` (Antigravity) con un bloque `## Model Requirement` equivalente. El protocolo `dual-sync.instructions.md` aplica sin excepciones.

## 5. Customendpoint NVIDIA — Setup opcional (espejo del §5 raíz)

> ⚠️ **Si NO se configura**, AOI sigue funcionando con los defaults Antigravity declarados en §1–§2 (`Claude Opus 4.6` y `GPT-5.4 xhigh`). El catálogo NVIDIA simplemente no se activa.

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

### Fuente

Catálogo basado en la [Recomendación Consolidada del Benchmark](../../Benchmark/model-reference/consolidated-recommendation.md), cruzando evaluaciones de Gemini, Grok y GPT con análisis propio de Claude Opus.
