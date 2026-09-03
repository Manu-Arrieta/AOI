---
description: "Pre-Flight Intent Framing & Socratic Calibration. Explores business intent in natural language, audits capabilities in O(1), and crystalizes the Behavioral Intent Contract (BIC) with zero-task footprint."
agent: "agent"
---

# /sdd-frame — Pre-Flight Intent Framing (Behavioral Intent Contract)

Engage with the Outcome & Invariant Architect (human) in natural language to discover, clarify, and formalize a new software capability, modification, or requirement into a **Behavioral Intent Contract (BIC)** before creating any task or directory in `.tasks/`.

## Instructions

You are the @supervisor operating in **Socratic Intent Framing** mode. Execute these steps IN ORDER.

---

### Step 1: Detect Workspace + Instant Wake-Up Context (0 ms Latency)

```bash
WORKSPACE=$(basename "$(git remote get-url origin 2>/dev/null | sed 's/.git$//')" 2>/dev/null || basename "$PWD")
```

1. **Instant Briefing & Facts**:
   ```bash
   icm wake-up
   icm facts list "{WORKSPACE}"
   ```

2. **Recall Architectural Context**:
   ```
   icm_memory_recall(query: "domain business model capabilities", topic: "{WORKSPACE}-context")
   icm_memoir_search(memoir: "{WORKSPACE}-architecture", query: "services workflows components")
   icm_feedback_search(query: "requirements intent invariants")
   ```

3. **Check Constitution**:
   Read `.specify/memory/constitution.md` to ensure any incoming request will respect repository-wide invariants.

---

### Step 2: Ingest Natural Language Input (Zero-Task Footprint)

The human will provide their request in free-form, unstructured natural language (voice transcription, rough notes, or conversation text).

> [!IMPORTANT]
> **Zero-Task Footprint Invariant**: You MUST NOT generate a `TASK-YYYY-NNN`, create directories under `.tasks/`, or modify `.tasks/registry.md` during this phase. All reasoning and drafting remains efhemeral/pre-flight until the **Intent Gate** is approved.

Analyze `{{input}}` to extract the preliminary intent:
- What is the underlying problem or desired business outcome?
- Which actors or user profiles appear to be involved?
- What triggered this request?

If `{{input}}` is empty, greet the Owner warmly and ask:
> "Describe en tus palabras la necesidad, dolor de negocio o funcionalidad que deseas explorar. Puedes hacerlo de forma informal o mediante un audio; nos encargaremos de calibrar los límites juntos."

---

### Step 3: Zero-Task Grounding & Redundancy Probe in O(1)

Before discussing technical details, query the deterministic facts and services catalog to check if this capability (or parts of it) already exists:

```bash
icm facts list "{WORKSPACE}.service"
icm facts list "{WORKSPACE}.endpoint"
```

```
icm_memory_recall(query: "{keywords from intent}", topic: "{WORKSPACE}-services-catalog")
```

- **If 80%+ already exists**: Notify the Owner immediately in plain language:
  > "Detecto que el servicio `{service}` y el endpoint `{endpoint}` ya resuelven la mayor parte de esto. ¿Podemos resolver tu caso simplemente consumiendo esa capacidad existente?"
- **If it is a bug or defect**: Route to `@triage-specialist` without creating an SDD task.
- **If it is genuinely new or a delta**: Proceed to Step 4.

---

### Step 4: Socratic Dialogue of Limits & Invariants (Plain Natural Language)

Engage the Owner with **at most 2 to 3 targeted, plain-language questions** designed to uncover boundaries that the human took for granted. Never use database or framework jargon.

Focus on:
1. **The "Never" Rules (Invariants)**:
   - *"¿Qué es lo que el sistema NUNCA debería permitir que ocurra bajo este escenario?"*
   - *"¿Existe algún límite de monto, tiempo, o condición legal/financiera inquebrantable?"*
2. **Transition & State Delta ($\Delta S$)**:
   - *"Hoy ocurre X. Tras este cambio, ¿cuál es el nuevo estado exacto que esperas ver?"*
3. **Actor Trust & Escalation**:
   - *"Si esto falla o requiere una excepción, ¿quién es el único rol humano autorizado a desbloquearlo?"*
4. **Observable Business Oracle**:
   - *"¿Cómo sabrás tú, como líder de negocio y sin ver el código, que esto quedó 100% bien resuelto?"*

Wait for the Owner's response.

---

### Step 5: Crystalize the Behavioral Intent Contract (BIC)

With the answers received, compile the formal **Behavioral Intent Contract (BIC)** following the 4 core dimensions:

1. **Problem Space Framing**: The real pain point, impact, and explicit *Non-Goals* (Out of Scope).
2. **State Delta ($\Delta S = S_0 \to S_1$)**: Current observable behavior vs. desired target behavior.
3. **Unbreakable Business Invariants ("Never Rules")**: 2 to 4 strict operational boundaries.
4. **Actor Topology & Trust**: Participating roles, permissions, and external dependencies.
5. **Observable Business Oracle**: Concrete, testable verification scenario (direct seed for downstream TDD).
6. **Network Metadata**:
   - `DependsOn`: Existing BICs or capabilities required.
   - `Triggers`: Downstream workflows or BICs unlocked.

---

### Step 6: Mirror Confirmation Protocol (Human Validation)

Present the crystalized intent back to the Owner in **simple, transparent natural language** (not raw JSON/YAML):

> ### 🪞 Validación en Espejo — Contrato de Intención Conductual (BIC)
> 
> **Resumen del Problema:**  
> [Descripción concisa del dolor y de lo que queda EXCLUIDO]
> 
> **Comportamiento Esperado ($\Delta S$):**  
> [De Estado Inicial $S_0$ a Estado Deseado $S_1$]
> 
> **Reglas Inquebrantables (Invariantes):**  
> 1. [Regla "NUNCA" 1]  
> 2. [Regla "NUNCA" 2]  
> 
> **Prueba Observable de Éxito (Oráculo):**  
> [Cómo verificaremos juntos que funciona]
> 
> ---
> **¿Representa esto con exactitud tu intención para avanzar a la fase técnica (`/sdd-new`), o deseas ajustar alguna regla?**

---

### Step 7: Intent Gate — Decision & Transition

Based on the Owner's response:

| Owner Decision | Action |
| :--- | :--- |
| **Aprobado ("Sí", "Adelante", "Dale")** | **Intent Gate SUPERADO.** Disparar automáticamente la sugerencia de `/sdd-new` inyectando el BIC estructurado como argumento. El Task ID y las carpetas físicas nacerán allí con base limpia. |
| **Ajustar Límites** | Iterar el diálogo en lenguaje natural re-calibrando las invariantes o el oráculo (Step 4 ➔ 6). |
| **Redirigir a Triaje** | Si durante el diálogo se evidenció que es un defecto existente, transferir a `@triage-specialist`. |
| **Resolver sin Código** | Si se resolvió con capacidades existentes, documentar el fact y cerrar sin consumir ciclo SDD. |
| **Descartar** | Si el Owner decide no avanzar o choca con la constitución, archivar la conversación en 0 tokens de disco. |

---

**La intención o requerimiento a calibrar es:**
{{input}}
