---
name: "Model Selection Protocol"
description: "Mandatory model selection rules for all AOI agents."
applyTo: ".github/{agents,prompts}/**,**/*.agent.md,**/*.prompt.md"
---

# Model Selection Protocol

**MANDATORY FOR ALL AGENTS**

## 1. Categorías

Razonamiento y arquitectura → `Razonamiento`. Implementación y terminal → `Implementación`.

La categoría es lo único que el repo declara. El modelo se **elige en el setup** (uno para
todos, por categoría o por agente) y sólo cambia con `/aoi-providers`.

## 2. Selection Rules (CRITICAL)

1. **Resolve, never recall**: el modelo sale de `provider-store.mjs --resolve <agente>`
   (ver `agent-delegation.instructions.md`, Step 1). Agente → categoría → todos.
2. **Missing Model Gate**: exit ≠ 0 o un modelo que no responde → el agente
   **DEBE PARAR y notificar**. Nunca elegir otro por su cuenta.

## 3. Multi-Provider & Tooling Context

Providers live in VS Code; `scripts/provider-vscode-setup.{sh,ps1}` **detects** them and
never writes a template. Terminal filtering is governed by `rtk.instructions.md`.
