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

Al invocar un agente via `runSubagent`, el caller DEBE pasar el parámetro `model` con el valor del `name` del modelo en el picker de Copilot, documentado en el `## Model Requirement` del agente destino:

```ts
// Ejemplos — consultar ## Model Requirement de cada agente para el valor exacto
runSubagent({ agentName: "functional-analyst", model: "Deepseek v4 pro - Provider - Deepseek", ... })
runSubagent({ agentName: "frontend-developer", model: "Glm5.2 - Provider - Zai", ... })
runSubagent({ agentName: "solution-architect", model: "Qwen 3.7 plus - Provider - Alibaba", ... })
runSubagent({ agentName: "ux-designer", model: "Minimax M3 - Provider - Minimax", ... })
```

> El modelo exacto que se pasa a `runSubagent` es el `name` del modelo en `ChatLanguageModel.json`, que coincide con lo documentado en el `## Model Requirement` del agente.

## 5. Asignación por Agente (tabla canónica — Julio 2026)

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

## 6. Mirror Obligatorio (Dual-Sync)

> Toda actualización de esta tabla canónica debe espejarse en `.agent/skills/_shared/model-selection.md` (Antigravity). El protocolo `dual-sync.instructions.md` aplica sin excepciones.
