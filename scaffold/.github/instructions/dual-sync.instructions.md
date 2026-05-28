---
applyTo: "**"
---

# Dual-Sync Protocol — Copilot ↔ Antigravity

## MANDATORY RULE

When creating, modifying, or deleting ANY agent or skill, you MUST synchronize BOTH platforms:

| Copilot                          | Antigravity                      |
| -------------------------------- | -------------------------------- |
| `.github/agents/{name}.agent.md` | `.agent/skills/agents/{name}.md` |

## Creating a New Agent

When asked to create a new agent, you MUST:

1. Create the Copilot version at `.github/agents/{name}.agent.md` with YAML frontmatter (`description`)
2. Create the Antigravity mirror at `.agent/skills/agents/{name}.md` with equivalent role and instructions
3. Update `GEMINI.md` to include the new agent in the agents table
4. Store in ICM: `icm_memory_store(topic: "{WORKSPACE}-context", content: "New agent created: {name} — {description}. Synced to both Copilot and Antigravity.", importance: "critical")`
5. Update the architecture memoir: `icm_memoir_add_concept(memoir: "{WORKSPACE}-architecture", name: "{name}", description: "...", labels: "type:agent")`

## Modifying an Agent

When modifying an agent, you MUST:

1. Apply the change to BOTH `.github/agents/{name}.agent.md` AND `.agent/skills/agents/{name}.md`
2. Keep role, responsibilities, and ICM protocol consistent across both
3. Store the modification in ICM memory

## Deleting an Agent

When removing an agent, you MUST:

1. Delete from BOTH locations
2. Remove from `GEMINI.md` agents table
3. Store the deletion in ICM memory

## Format Differences

### Copilot (`.agent.md`)

```yaml
---
description: One-line description of the agent
---
# Agent Name

Instructions here...
```

### Antigravity (`.md` skill)

```markdown
# Agent Name

> Role: One-line description

Instructions here...
```

## Validation

Before completing any agent/skill operation, verify:

- [ ] Copilot version exists at `.github/agents/{name}.agent.md`
- [ ] Antigravity version exists at `.agent/skills/agents/{name}.md`
- [ ] Both have consistent role descriptions
- [ ] Both reference the shared ICM protocol
- [ ] `GEMINI.md` agents table is up to date
- [ ] Change persisted in ICM

**If ANY of these checks fail, the operation is NOT complete.**
