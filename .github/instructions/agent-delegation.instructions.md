---
name: "Agent Delegation Protocol"
description: "Mandatory protocol for all agents that invoke runSubagent. Model selection, prompt template, and verification steps."
applyTo: "**"
---

# Agent Delegation Protocol

**MANDATORY for all agents that invoke `runSubagent`.**

When delegating work to another agent, the caller MUST follow this protocol. NO EXCEPTIONS.

## Step 1 — Look up the agent in the Registry

Consult the Agent Registry below to find:

- `model` — exact value for `runSubagent` parameter
- `skillPath` — skill file the subagent MUST read as its first action

## Step 2 — Construct the prompt

Use this template. The FIRST instruction MUST tell the subagent to read its skill:

```
[CONTEXT: workspace, feature, TASK-ID, relevant ICM topics]

FIRST: Read your skill file at [skillPath]. Follow its Session Start protocol
(activate MCP tool groups, recall ICM context). Do NOT skip this step.

THEN: [specific task — what to do, constraints, deliverables]

Relevant files: [absolute paths to files the subagent needs]
Expected output: [exactly what to return or what files to create/modify]
```

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
- [ ] The output matches the expected format

## Agent Registry

| Agent                    | `runSubagent` model                     | Skill                                            | Category       |
| ------------------------ | --------------------------------------- | ------------------------------------------------ | -------------- |
| `supervisor`             | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/supervisor.agent.md`             | Razonamiento   |
| `solution-architect`     | `Qwen 3.7 plus - Provider - Alibaba`    | `.github/agents/solution-architect.agent.md`     | Razonamiento   |
| `functional-analyst`     | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/functional-analyst.agent.md`     | Razonamiento   |
| `triage-specialist`      | `Qwen 3.7 plus - Provider - Alibaba`    | `.github/agents/triage-specialist.agent.md`      | Razonamiento   |
| `integration-specialist` | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/integration-specialist.agent.md` | Razonamiento   |
| `documentation-analyst`  | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/documentation-analyst.agent.md`  | Razonamiento   |
| `project-analyzer`       | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/project-analyzer.agent.md`       | Razonamiento   |
| `project-expert`         | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/project-expert.agent.md`         | Razonamiento   |
| `resource-analyst`       | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/resource-analyst.agent.md`       | Razonamiento   |
| `ux-designer`            | `Minimax M3 - Provider - Minimax`       | `.github/agents/ux-designer.agent.md`            | Razonamiento   |
| `frontend-developer`     | `Glm5.2 - Provider - Zai`               | `.github/agents/frontend-developer.agent.md`     | Implementación |
| `backend-developer`      | `Glm5.2 - Provider - Zai`               | `.github/agents/backend-developer.agent.md`      | Implementación |
| `devops-engineer`        | `Glm5.2 - Provider - Zai`               | `.github/agents/devops-engineer.agent.md`        | Implementación |

### Agentes Spec-Kit

| Agent                    | `runSubagent` model                     | Skill                                            | Category       |
| ------------------------ | --------------------------------------- | ------------------------------------------------ | -------------- |
| `speckit.constitution`   | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.constitution.agent.md`   | Razonamiento   |
| `speckit.specify`        | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.specify.agent.md`        | Razonamiento   |
| `speckit.clarify`        | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.clarify.agent.md`        | Razonamiento   |
| `speckit.plan`           | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.plan.agent.md`           | Razonamiento   |
| `speckit.tasks`          | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.tasks.agent.md`          | Razonamiento   |
| `speckit.analyze`        | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.analyze.agent.md`        | Razonamiento   |
| `speckit.checklist`      | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.checklist.agent.md`      | Razonamiento   |
| `speckit.taskstoissues`  | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/speckit.taskstoissues.agent.md`  | Razonamiento   |
| `speckit.implement`      | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.implement.agent.md`      | Implementación |
| `speckit.git.initialize` | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.git.initialize.agent.md` | Implementación |
| `speckit.git.feature`    | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.git.feature.agent.md`    | Implementación |
| `speckit.git.commit`     | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.git.commit.agent.md`     | Implementación |
| `speckit.git.remote`     | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.git.remote.agent.md`     | Implementación |
| `speckit.git.validate`   | `Glm5.2 - Provider - Zai`               | `.github/agents/speckit.git.validate.agent.md`   | Implementación |

## Example: invoking solution-architect correctly

```ts
runSubagent({
  agentName: "solution-architect",
  model: "Qwen 3.7 plus - Provider - Alibaba",
  description: "Design customer deployment plan",
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

## Anti-patterns — NEVER do this

```ts
// ❌ No model specified
runSubagent({ agentName: "solution-architect", prompt: "..." })

// ❌ Prompt doesn't tell the subagent to read its skill
runSubagent({ agentName: "backend-developer", model: "GLM-5.2", prompt: "Implement X" })

// ❌ Wrong model for agent category
runSubagent({ agentName: "solution-architect", model: "Glm5.2 - Provider - Zai", ... })

// ❌ Subagent doesn't know the workspace or TASK-ID
runSubagent({ agentName: "frontend-developer", model: "GLM-5.2", prompt: "Fix the header" })
```
