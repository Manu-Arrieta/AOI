---
name: "Agent Delegation Protocol"
description: "Mandatory protocol for all agents that invoke runSubagent. Model selection, prompt template, subagent payload sanitization, and verification steps."
applyTo: ".github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md"
---

> ⚠️ Cada agente declara su **CATEGORÍA**. Su modelo se elige en el setup y sólo cambia con
> `/aoi-providers`. Este archivo es el registro.

# Agent Delegation Protocol

**MANDATORY for all agents that invoke `runSubagent`.**

When delegating work to another agent, the caller MUST follow this protocol. NO EXCEPTIONS.

## Step 1 — Resolve the model

```bash
node scripts/multi-harness/provider-store.mjs --resolve <agent>
```

It prints the exact `model` value. Non-zero exit: **do NOT delegate**; tell the Owner to
run `/aoi-providers`. `{SKILL_PATH}` is `.github/agents/<agent>.agent.md`.

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
  model: "[output of Step 1]",
  description: "[3-5 word description]",
  prompt: "[prompt from Step 2]",
});
```

## Step 4 — Verify

After the subagent returns, verify:
- [ ] The subagent used the model Step 1 printed
- [ ] The subagent read its skill file
- [ ] The output matches the expected format and constraints

---

## Agent Registry

> La ruta del archivo no se lista: es `.github/agents/<agente>.agent.md` en los 27 casos,
> así que la columna solo repetía el nombre con envoltorio. `pnpm aoi:routing` la deriva y
> verifica que el archivo exista, de modo que la garantía es la misma y no se paga en cada
> inyección.

> [!IMPORTANT]
> **Acá NO se declara el proveedor.** La asignación vive en ICM (`{WORKSPACE}.assignment.*`)
> y se lee con el Step 1, nunca de memoria. `pnpm aoi:providers` falla si un valor asignado
> no está configurado en la máquina.

### Domain Agents

| Agent | Category |
| :--- | :--- |
| `supervisor` | Razonamiento |
| `solution-architect` | Razonamiento |
| `functional-analyst` | Razonamiento |
| `triage-specialist` | Razonamiento |
| `integration-specialist` | Razonamiento |
| `documentation-analyst` | Razonamiento |
| `project-analyzer` | Razonamiento |
| `project-expert` | Razonamiento |
| `resource-analyst` | Razonamiento |
| `ux-designer` | Razonamiento |
| `frontend-developer` | Implementación |
| `backend-developer` | Implementación |
| `devops-engineer` | Implementación |

### Spec-Kit Agents

| Agent | Category |
| :--- | :--- |
| `speckit.constitution` | Razonamiento |
| `speckit.specify` | Razonamiento |
| `speckit.clarify` | Razonamiento |
| `speckit.plan` | Razonamiento |
| `speckit.tasks` | Razonamiento |
| `speckit.analyze` | Razonamiento |
| `speckit.checklist` | Razonamiento |
| `speckit.taskstoissues` | Razonamiento |
| `speckit.implement` | Implementación |
| `speckit.git.initialize` | Implementación |
| `speckit.git.feature` | Implementación |
| `speckit.git.commit` | Implementación |
| `speckit.git.remote` | Implementación |
| `speckit.git.validate` | Implementación |


---

## Anti-Patterns — NEVER Do This

```ts
// ❌ 1. No model specified
runSubagent({ agentName: "solution-architect", prompt: "..." })

// ❌ 2. Prompt doesn't tell the subagent to read its skill file first
runSubagent({ agentName: "backend-developer", model: resolved, prompt: "Implement X" })

// ❌ 3. A model typed by hand instead of the Step 1 output
runSubagent({ agentName: "solution-architect", model: "hardcoded", ... })

// ❌ 4. Subagent lacks workspace, feature or TASK-ID context
runSubagent({ agentName: "frontend-developer", model: resolved, prompt: "Fix X" })
```
