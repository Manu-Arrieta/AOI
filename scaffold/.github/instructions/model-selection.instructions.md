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
