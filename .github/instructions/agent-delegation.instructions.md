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

| Agent                    | `runSubagent` model                     | Skill (Copilot)                                  | Skill (Antigravity)                              | Category       |
| ------------------------ | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------ | -------------- |
| `supervisor`             | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/supervisor.agent.md`             | `.agent/skills/agents/supervisor.md`             | Razonamiento   |
| `solution-architect`     | `Qwen 3.7 plus - Provider - Alibaba`    | `.github/agents/solution-architect.agent.md`     | `.agent/skills/agents/solution-architect.md`     | Razonamiento   |
| `functional-analyst`     | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/functional-analyst.agent.md`     | `.agent/skills/agents/functional-analyst.md`     | Razonamiento   |
| `triage-specialist`      | `Qwen 3.7 plus - Provider - Alibaba`    | `.github/agents/triage-specialist.agent.md`      | `.agent/skills/agents/triage-specialist.md`      | Razonamiento   |
| `integration-specialist` | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/integration-specialist.agent.md` | `.agent/skills/agents/integration-specialist.md` | Razonamiento   |
| `documentation-analyst`  | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/documentation-analyst.agent.md`  | `.agent/skills/agents/documentation-analyst.md`  | Razonamiento   |
| `project-analyzer`       | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/project-analyzer.agent.md`       | `.agent/skills/agents/project-analyzer.md`       | Razonamiento   |
| `project-expert`         | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/project-expert.agent.md`         | `.agent/skills/agents/project-expert.md`         | Razonamiento   |
| `resource-analyst`       | `Deepseek v4 pro - Provider - Deepseek` | `.github/agents/resource-analyst.agent.md`       | `.agent/skills/agents/resource-analyst.md`       | Razonamiento   |
| `ux-designer`            | `Minimax M3 - Provider - Minimax`       | `.github/agents/ux-designer.agent.md`            | `.agent/skills/agents/ux-designer.md`            | Razonamiento   |
| `frontend-developer`     | `Glm5.2 - Provider - Zai`               | `.github/agents/frontend-developer.agent.md`     | `.agent/skills/agents/frontend-developer.md`     | Implementación |
| `backend-developer`      | `Glm5.2 - Provider - Zai`               | `.github/agents/backend-developer.agent.md`      | `.agent/skills/agents/backend-developer.md`      | Implementación |
| `devops-engineer`        | `Glm5.2 - Provider - Zai`               | `.github/agents/devops-engineer.agent.md`        | `.agent/skills/agents/devops-engineer.md`        | Implementación |

## Example: invoking solution-architect correctly

```ts
runSubagent({
  agentName: "solution-architect",
  model: "Qwen 3.7 OR",
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
runSubagent({ agentName: "solution-architect", model: "GLM-5.2", ... })

// ❌ Subagent doesn't know the workspace or TASK-ID
runSubagent({ agentName: "frontend-developer", model: "GLM-5.2", prompt: "Fix the header" })
```
