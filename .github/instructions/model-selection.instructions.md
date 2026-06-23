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
