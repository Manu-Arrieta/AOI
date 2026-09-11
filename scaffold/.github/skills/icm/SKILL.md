---
name: icm
description: Infinite Context Memory (ICM) protocol — store, recall, exact O(1) facts, memoir graph, feedback, and transcripts across agent sessions. Use when the task involves remembering context, decisions, errors, or project knowledge across sessions.
---

<!-- canonical-instruction: icm-protocol.instructions.md -->

# ICM — Infinite Context Memory Protocol

El protocolo completo —aislamiento de workspace, activación MCP, los cinco
sistemas, el grafo de memoirs, las briefings de wake-up, la política de
importancia y los disparadores por fase— vive en
`.github/instructions/icm-protocol.instructions.md`, que tiene `applyTo: "**"`
y por lo tanto ya está en este contexto. Repetirlo acá costaba 576 tokens en
cada una de las seis fases para decir dos veces lo mismo.

Antigravity, que no lee `.github/instructions/`, recibe el protocolo **entero**
derivado en `.agents/skills/icm/SKILL.md`.

Lo esencial, por si la instruction no estuviera cargada:

- ICM tiene **five memory systems** y los cinco son obligatorios: **Memories**
  (decaen), **Memoirs** (arquitectura, permanentes), **Facts** (exactos O(1),
  permanentes), **Feedback** (aprender del error) y **Transcripts**.
- Un dato exacto —endpoint, puerto, invariante de un BIC— se escribe con
  `icm facts set "{WORKSPACE}" "clave" "valor"`, tres argumentos separados, y
  NO como memoria. Es el sistema que lee la compuerta de invariantes.
- Recordá antes de trabajar y almacená apenas ocurre el disparador, no al
  final.
- **20+ llamadas a herramientas sin un store** es en sí mismo un disparador:
  guardá un resumen de progreso. Este umbral no está en ninguna otra parte.
