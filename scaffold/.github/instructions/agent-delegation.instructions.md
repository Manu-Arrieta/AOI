---
name: "Agent Delegation Protocol"
description: "Mandatory protocol for all agents that invoke runSubagent. Model selection, prompt template, subagent payload sanitization, and verification steps."
applyTo: ".github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md"
---

# Agent Delegation Protocol

**MANDATORY for all agents that invoke `runSubagent`.**

When delegating work to another agent, the caller MUST follow this protocol. NO EXCEPTIONS.

## Step 1 — Look up the agent in the Registry

Consult the Agent Registry below to find:
- `model` — exact value for the `runSubagent` parameter
- `skillPath` — skill file the subagent MUST read as its first action

## Step 2 — Construct Sanitized Payload (MANDATORY)

To prevent conversation history bloat and massive token consumption, the supervisor **MUST ALWAYS** construct an isolated payload using `scripts/subagent-context/sanitize-subagent-payload.mjs`:

```bash
node scripts/subagent-context/sanitize-subagent-payload.mjs --role [agent-role] --task-dir .tasks/{feature}/{task-id} [--format toon]
```

The constructed prompt MUST follow this template:

```text
Workspace: {WORKSPACE_NAME}, {ABSOLUTE_PATH}
Feature: {FEATURE}, TASK-{ID}
ICM topic: sdd-{WORKSPACE_NAME}-{FEATURE}-TASK-{ID}

FIRST: Read your skill file at {SKILL_PATH}. Follow its Session Start protocol (activate MCP tool groups, recall ICM context). Do NOT skip this step.

THEN: [Specific task — what to do, constraints, deliverables]
TDD Requirements: [Red -> Green -> Refactor test criteria]
Contracts / Interfaces: [Extracted contract signatures from design.md]

Relevant files: [Absolute paths to files the subagent needs]
Expected output: [Exactly what to return or what files to create/modify]
```

> ⚠️ **Zero Bloat Policy**: NEVER pass multi-turn chat history, irrelevant tasks, or entire full-file dumps into subagents.

## Step 3 — Invoke with model

```ts
runSubagent({
  agentName: "[agent from Registry]",
  model: "[model from Registry]",
  description: "[3-5 word description]",
  prompt: "[prompt from Step 2]",
});
```

## Step 4 — Verify

After the subagent returns, verify:
- [ ] The subagent used the correct model (check its response for tool calls)
- [ ] The subagent read its skill file
- [ ] The output matches the expected format and constraints

---

## Agent Registry

> La ruta del archivo no se lista: es `.github/agents/<agente>.agent.md` en los 27 casos,
> así que la columna solo repetía el nombre con envoltorio. `pnpm aoi:routing` la deriva y
> verifica que el archivo exista, de modo que la garantía es la misma y no se paga en cada
> inyección.

### Domain Agents

| Agent | `runSubagent` Model Parameter | Fallback (NVIDIA NIM) | Category |
| :--- | :--- | :--- | :--- |
| `supervisor` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `solution-architect` | `Qwen 3.7 plus - Provider - Alibaba` | DeepSeek (`deepseek-v4-pro`) | Razonamiento |
| `functional-analyst` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `triage-specialist` | `Qwen 3.7 plus - Provider - Alibaba` | DeepSeek (`deepseek-v4-pro`) | Razonamiento |
| `integration-specialist` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `documentation-analyst` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `project-analyzer` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `project-expert` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `resource-analyst` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `ux-designer` | `Minimax M3 - Provider - Minimax` | `minimaxai/minimax-m3` | Razonamiento |
| `frontend-developer` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `backend-developer` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `devops-engineer` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |

### Spec-Kit Agents

| Agent | `runSubagent` Model Parameter | Fallback (NVIDIA NIM) | Category |
| :--- | :--- | :--- | :--- |
| `speckit.constitution` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.specify` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.clarify` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.plan` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.tasks` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.analyze` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.checklist` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.taskstoissues` | `Deepseek v4 pro - Provider - Deepseek` | `deepseek-ai/deepseek-v4-pro` | Razonamiento |
| `speckit.implement` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `speckit.git.initialize` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `speckit.git.feature` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `speckit.git.commit` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `speckit.git.remote` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |
| `speckit.git.validate` | `Glm5.2 - Provider - Zai` | `z-ai/glm-5.2` | Implementación |

---

## Example: Invoking `solution-architect`

```ts
runSubagent({
  agentName: "solution-architect",
  model: "Qwen 3.7 plus - Provider - Alibaba",
  description: "Design architecture and task plan",
  prompt: `Workspace: {PROJECT}, {ABSOLUTE_PATH}
Feature: {FEATURE}, TASK-{ID}
ICM topic: sdd-{PROJECT}-{FEATURE}-TASK-{ID}

FIRST: Read your skill file at .github/agents/solution-architect.agent.md.
Follow its Session Start protocol (activate MCP tool groups, recall ICM context).
Do NOT skip this step.

THEN: Create design.md and plan.md for [...].
Read the proposal first. Follow your SDD Plan phase protocol exactly.

Relevant files: [...]
Expected output: [...]`,
});
```

---

## Anti-Patterns — NEVER Do This

```ts
// ❌ 1. No model specified
runSubagent({ agentName: "solution-architect", prompt: "..." })

// ❌ 2. Prompt doesn't instruct subagent to read its skill file first
runSubagent({ agentName: "backend-developer", model: "Glm5.2 - Provider - Zai", prompt: "Implement X" })

// ❌ 3. Wrong model for agent category
runSubagent({ agentName: "solution-architect", model: "Glm5.2 - Provider - Zai", ... })

// ❌ 4. Subagent lacks workspace, feature or TASK-ID context
runSubagent({ agentName: "frontend-developer", model: "Glm5.2 - Provider - Zai", prompt: "Fix the header" })
```
