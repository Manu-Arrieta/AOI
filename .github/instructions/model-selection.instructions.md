---
name: "Model Selection Protocol"
description: "Mandatory model selection rules for all AOI agents. Covers reasoning, implementation, multi-provider config, and NVIDIA fallback."
applyTo: ".github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md"
---

# Model Selection Protocol

**MANDATORY FOR ALL AGENTS**

---

## 1. Categorías (solo para autoría de agentes nuevos)

Razonamiento y arquitectura → `DeepSeek V4 Pro`. Implementación y terminal → `GLM-5.2`.
Es una guía para elegir al crear un agente, no una regla de runtime: la regla 2.1 hace que
el bloque del propio agente siempre gane, y `pnpm aoi:routing` rechaza a cualquier agente
sin fila explícita en el registro, así que un default nunca llega a aplicarse.

## 2. Preeminence & Selection Rules (CRITICAL)

1. **Preeminence**: An agent's `## Model Requirement` block in its `.agent.md` file supersedes category defaults.
2. **Picker Hierarchy**: The operator MUST select the `Primary` model in the picker before invocation. If unavailable, select the `Fallback`.
3. **Missing Model Gate**: If neither `Primary` nor `Fallback` is available in the picker, the agent **MUST STOP and notify the operator** before executing any tool or modifying files.

---

## 3. Valores concretos de `runSubagent`

> Fuente única: el **Agent Registry** de `agent-delegation.instructions.md`.

## 4. Multi-Provider & Tooling Context

* Configuration template lives at `scaffold/.vscode/ChatLanguageModel.example.json`.
* Automated setup via `scripts/nvidia-vscode-setup.{sh,ps1}` (Phase 1.5).
* Compression via Headroom (Phase 1.6) and RTK for terminal command filtering (60–90% token reduction).
