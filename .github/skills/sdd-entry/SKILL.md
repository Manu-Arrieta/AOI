---
name: sdd-entry
description: Cómo elegir el comando con el que se entra al ciclo SDD — `/sdd-genesis` para una idea abstracta sin arquitectura, `/sdd-frame` para intención en lenguaje natural, `/sdd-new` para un requerimiento ya acotado. Use when starting new work, deciding between /sdd-genesis, /sdd-frame and /sdd-new, or when a requirement arrives without a task ID.
---

# Entrada al ciclo SDD — qué comando invocar

Esta guía solo aplica al **momento de entrar** al ciclo. Vivía dentro de la skill general y
se cargaba en las seis fases, incluidas las cuatro donde la decisión ya está tomada desde
hace dos pasos.

## Tres entradas, no dos

| | `/sdd-genesis` | `/sdd-frame` | `/sdd-new` |
| --- | --- | --- | --- |
| **Qué tenés** | Una idea ("quiero construir…") | Una intención de negocio | Un requerimiento acotado |
| **Qué falta** | La arquitectura entera | Las reglas y el oráculo | El plan técnico |
| **Produce** | **SBC** (System Blueprint Contract) | **BIC** (contrato de comportamiento) | `proposal.md` + `TASK-YYYY-NNN` |
| **Crea tarea en disco** | No | No | **Sí** |
| **Gate** | Genesis Gate | Intent Gate | Proposal Gate |

**Elegí `/sdd-genesis` cuando** lo que hay es una idea y todavía no existe arquitectura que
la contenga: no sabés en qué dominios se parte el sistema, ni qué invariantes son globales,
ni cuál es la primera rebanada vertical. Sale un SBC, y de un SBC salen **varios** BICs.

**Elegí `/sdd-frame` cuando** la arquitectura ya existe (o la tarea vive dentro de un SBC
aprobado) y lo que falta es destilar las reglas de UN flujo.

**Elegí `/sdd-new` cuando** el requerimiento ya está acotado y no hace falta calibrar nada.

## Pre-Flight (/sdd-frame) vs. Explore (/sdd-new) — When to Use Which

`/sdd-frame` and `/sdd-new` serve distinct purposes in the lifecycle and are fully decoupled. Entering `/sdd-frame` is **optional**:

| Dimension | `/sdd-frame` (Pre-Flight) | `/sdd-new` (Explore & Propose) |
| --------- | ------------------------- | ------------------------------ |
| **Space** | **Problem Space**: Understands the pain, outcomes, and invariants. | **Solution Space**: Explores code, architecture, and technical feasibility. |
| **Disk Footprint** | **Zero-Task Footprint**: No task ID, no `.tasks/` folders, no registry pollution. | **Materialized**: Allocates `TASK-YYYY-NNN`, creates task directory, registers in `.tasks/registry.md`. |
| **Input Format** | Natural language (voice, conversational text, raw business notes). | Structured requirement or calibrated BIC from `/sdd-frame`. |
| **Output** | Behavioral Intent Contract (BIC) / ephemeral intent canvas. | `proposal.md` with technical architecture & acceptance criteria. |
| **Gate** | **Intent Gate**: Owner approves mental model and "Never" rules. | **Proposal Gate**: Owner approves technical approach to enter `/sdd-ff`. |

### Decision Guide: Which Command to Start With?

- **Use `/sdd-frame` first when:**
  - The requirement is expressed in informal natural language or open business ideas.
  - You want to verify in O(1) against ICM facts if the capability already exists before committing a task ID.
  - You need socratic probing to surface hidden boundaries, "Never" rules (invariants), and measurable success oracles.
- **Go directly to `/sdd-new` when:**
  - The requirement is already mature, crisp, and technically bounded in your mind.
  - It is a concrete technical improvement, refactor, or feature with well-known boundaries.
  - You want to immediately mint `TASK-YYYY-NNN`, run the mandatory Service Discovery Gate, and generate `proposal.md`.
