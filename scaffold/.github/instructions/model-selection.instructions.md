---
name: "Model Selection Protocol"
description: "Mandatory model selection rules for all AOI agents. Covers reasoning, implementation, multi-provider config, and NVIDIA fallback."
applyTo: ".github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md"
---

# Model Selection Protocol

**MANDATORY FOR ALL AGENTS**

---

## 1. Category Defaults

* **Abstract Reasoning / Architecture / Planning / Analysis**: `DeepSeek V4 Pro`
  *(supervisor, solution-architect, functional-analyst, triage-specialist, resource-analyst, integration-specialist, documentation-analyst, project-analyzer, project-expert, ux-designer, speckit reasoning agents)*
* **Implementation / Code / Terminal / IaC**: `GLM-5.2`
  *(frontend-developer, backend-developer, devops-engineer, speckit.implement, speckit.git.initialize, speckit.git.feature, speckit.git.commit, speckit.git.remote, speckit.git.validate)*

---

## 2. Preeminence & Selection Rules (CRITICAL)

1. **Preeminence**: An agent's `## Model Requirement` block in its `.agent.md` file supersedes category defaults.
2. **Picker Hierarchy**: The operator MUST select the `Primary` model in the picker before invocation. If unavailable, select the `Fallback`.
3. **Missing Model Gate**: If neither `Primary` nor `Fallback` is available in the picker, the agent **MUST STOP and notify the operator** before executing any tool or modifying files.

---

## 3. Agent Assignment & `runSubagent` Model Values

> **Fuente única de verdad: el Agent Registry de `agent-delegation.instructions.md`.**
> Ahí vive el mapeo completo de los 27 agentes a su parámetro de modelo, su fallback
> de NVIDIA NIM, su skill path y su categoría.
>
> Esta tabla estaba duplicada aquí carácter por carácter. Ambos archivos se inyectan
> juntos en el contexto de cualquier `.prompt.md`, así que la copia se pagaba en las
> seis fases del ciclo sin agregar una sola capacidad. Las reglas de selección de la
> sección 2 siguen siendo de este archivo; los valores concretos, no.


## 4. Multi-Provider & Tooling Context

* Configuration template lives at `scaffold/.vscode/ChatLanguageModel.example.json`.
* Automated setup via `scripts/nvidia-vscode-setup.{sh,ps1}` (Phase 1.5).
* Compression via Headroom (Phase 1.6) and RTK for terminal command filtering (60–90% token reduction).
