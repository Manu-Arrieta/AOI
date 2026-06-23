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

### Fuente

Catálogo basado en la [Recomendación Consolidada del Benchmark](../../Benchmark/model-reference/consolidated-recommendation.md), cruzando evaluaciones de Gemini, Grok y GPT con análisis propio de Claude Opus.
