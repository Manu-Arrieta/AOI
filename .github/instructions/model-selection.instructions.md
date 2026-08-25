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

### Domain Agents

| Agent | Model Name for `runSubagent` | Primary Provider | Fallback (NVIDIA NIM) | Category |
| :--- | :--- | :--- | :--- | :--- |
| `@supervisor` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@functional-analyst` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@solution-architect` | `Qwen 3.7 plus - Provider - Alibaba` | Alibaba (`qwen3.7-plus`) | DeepSeek (`deepseek-v4-pro`) | Reasoning |
| `@frontend-developer` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` | Implementation |
| `@backend-developer` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` | Implementation |
| `@devops-engineer` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` | Implementation |
| `@ux-designer` | `Minimax M3 - Provider - Minimax` | MiniMax (`MiniMax-M3`) | `minimaxai/minimax-m3` | Reasoning / Visual |
| `@integration-specialist` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@documentation-analyst` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@triage-specialist` | `Qwen 3.7 plus - Provider - Alibaba` | Alibaba (`qwen3.7-plus`) | DeepSeek (`deepseek-v4-pro`) | Reasoning |
| `@resource-analyst` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@project-analyzer` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |
| `@project-expert` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` | Reasoning |

### Spec-Kit Agents

| Agent | Model Name for `runSubagent` | Primary Provider | Fallback (NVIDIA NIM) |
| :--- | :--- | :--- | :--- |
| `speckit.constitution` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.specify` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.clarify` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.plan` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.tasks` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.analyze` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.checklist` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.taskstoissues` | `Deepseek v4 pro - Provider - Deepseek` | DeepSeek (`deepseek-v4-pro`) | `deepseek-ai/deepseek-v4-pro` |
| `speckit.implement` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |
| `speckit.git.initialize` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |
| `speckit.git.feature` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |
| `speckit.git.commit` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |
| `speckit.git.remote` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |
| `speckit.git.validate` | `Glm5.2 - Provider - Zai` | Zai (`glm-5.2`) | `z-ai/glm-5.2` |

---

## 4. Multi-Provider & Tooling Context

* Configuration template lives at `scaffold/.vscode/ChatLanguageModel.example.json`.
* Automated setup via `scripts/nvidia-vscode-setup.{sh,ps1}` (Phase 1.5).
* Compression via Headroom (Phase 1.6) and RTK for terminal command filtering (60–90% token reduction).
