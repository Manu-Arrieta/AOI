# AOI — Agentic Operational Infrastructure

Tu equipo de desarrollo de software, orquestado por IA.

AOI transforma cualquier repositorio en un espacio de trabajo inteligente con **memoria persistente**, **agentes especializados**, y un **ciclo de vida completo** desde la idea hasta el cierre.

---

## ¿Cómo funciona?

```
Tu proyecto vacío
       ↓
   setup.sh          ← Instala herramientas + agentes
       ↓
   /init             ← Configura tu stack y convenciones
       ↓
   /sdd-new          ← Explora y propone un feature
       ↓
   /sdd-ff           ← Diseña, planifica, genera tareas
       ↓
   /sdd-apply        ← Implementa con TDD
       ↓
   /sdd-verify       ← Verifica calidad y principios
       ↓
   /sdd-archive      ← Documenta y cierra
```

Cada paso tiene una **aprobación del Owner** antes de avanzar. Tú decides, la IA ejecuta.

---

## Instalación

### macOS / Linux

```bash
bash "/path/to/AOI/setup.sh" /path/to/my-project
```

### Windows 11+

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\path\to\my-project"
```

### Prerequisitos

- Node ≥ 20.19
- pnpm ≥ 11.3
- [ICM](https://github.com/rtk-ai/icm) (memoria persistente)
- GitHub Copilot en VS Code

### Primer uso

```text
# En VS Code Copilot Chat:
/init           ← Configura stack, agentes, convenciones
/sdd-new        ← Inicia tu primer feature
```

---

## El Ciclo de Vida

### 1. `/sdd-new` — Explorar + Proponer

El **@supervisor** coordina la exploración: analiza el codebase, identifica servicios existentes, evalúa la complejidad, y produce una **propuesta** para aprobación del Owner.

**Qué evalúa:**
- ¿Ya existe algo que resuelva esto? (Service Discovery)
- ¿Cuál es la solución más simple? (KISS)
- ¿Qué capas del sistema toca? (Separation of Concerns)
- ¿Hay riesgos de seguridad? (Security)

**Produce:** `proposal.md` con evaluación de principios

---

### 2. `/sdd-ff` — Diseñar + Planificar

El **@functional-analyst** especifica los requerimientos. El **@solution-architect** diseña la solución y genera las tareas de implementación.

**Qué exige:**
- Cada componente tiene una sola responsabilidad (SRP)
- El diseño permite extensión sin modificar código existente (OCP)
- Las dependencias van hacia abstracciones, no hacia implementaciones (DIP)
- Los contratos de API se definen antes de implementar (Contract-First)
- Se define qué observar: logs, métricas, traces (Observability)
- Cada tarea incluye requerimientos de testing (TDD)

**Produce:** `spec.md` + `design.md` + `tasks.md` + `implementation-plan.md`

---

### 3. `/sdd-apply` — Implementar

Los agentes especializados (**@frontend-developer**, **@backend-developer**, **@devops-engineer**) implementan cada tarea siguiendo TDD: escriben el test primero (RED), luego el código (GREEN), luego optimizan (REFACTOR).

**Qué revisa después de cada tarea:**
- Archivos no exceden ~300 líneas (SRP)
- No se duplica código (DRY)
- No se agregan abstracciones innecesarias (KISS)
- Las funciones validan sus inputs (Fail Fast)
- Se prefiere composición sobre herencia (Composition)
- Inputs validados, secrets seguros, SQL parametrizado (Security)

**Produce:** Código implementado + tests + logs de iteración

---

### 4. `/sdd-verify` — Verificar

El **@integration-specialist** verifica que todo cumple con la especificación, los principios de calidad, y los gates automatizados.

**Gates automáticos (FAIL si no se cumplen):**
- ✅ Tests pasan (TDD Gate)
- ✅ Service Discovery fue ejecutado
- ✅ No hay secrets hardcodeados (Security Gate)
- ✅ Sandbox manifest válido (si aplica)

**Verificaciones de principios (WARNING):**
- Archivos >300 LOC
- Imports circulares
- Código duplicado >10 líneas
- Catch blocks vacíos
- Endpoints sin logging
- Contratos de API que no coinciden con spec

**Produce:** `verify-report.md` con PASS / FAIL / PARTIAL

---

### 5. `/sdd-archive` — Documentar + Cerrar

El **@documentation-analyst** genera la documentación funcional, consolida la memoria, y cierra formalmente el feature.

**Documenta:**
- Qué se construyó y por qué
- Decisiones clave con su justificación
- Qué se excluyó deliberadamente (YAGNI)
- Patrones reutilizables extraídos (DRY)
- Estado de seguridad y observabilidad

**Produce:** `functional-docs.md` + `archive-report.md`

---

## Los Agentes

AOI opera con un modelo **Hub-and-Spoke**: el Supervisor coordina, los especialistas ejecutan.

```
                    ┌──────────────┐
                    │  @supervisor │  ← Coordina todo
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   ┌───────────────┐ ┌────────────┐ ┌──────────────┐
   │  Explorar     │ │ Implementar│ │   Verificar  │
   │───────────────│ │────────────│ │──────────────│
   │ @functional-  │ │ @frontend- │ │ @integration-│
   │  analyst      │ │  developer │ │  specialist  │
   │ @solution-    │ │ @backend-  │ │ @documentation│
   │  architect    │ │  developer │ │  -analyst    │
   │               │ │ @devops-   │ │              │
   │               │ │  engineer  │ │              │
   │               │ │ @ux-       │ │              │
   │               │ │  designer  │ │              │
   └───────────────┘ └────────────┘ └──────────────┘
```

**Transversales:** `@triage-specialist` (bugs), `@resource-analyst` (recursos), `@project-analyzer` + `@project-expert` (análisis)

---

## Herramientas

| Herramienta | Qué hace | Obligatoria |
|-------------|----------|:-----------:|
| **ICM** | Memoria persistente entre sesiones | ✅ |
| **RTK** | Optimiza tokens de salida terminal (60-90% ahorro) | ⚠️ |
| **Headroom** | Comprime contexto para CLI (hasta 95% ahorro) | ⚠️ |
| **Codebase Memory** | Grafo de código navegable por los agentes | ⚠️ |
| **Spec-Kit** | Motor del ciclo SDD | ⚠️ |

---

## Memoria

La IA **no olvida** entre sesiones. ICM mantiene 4 tipos de memoria:

| Tipo | Para qué | Cuándo |
|------|----------|--------|
| **Memories** | Decisiones, progreso, contexto | Cada fase |
| **Memoirs** | Arquitectura y relaciones entre componentes | Diseño |
| **Feedback** | Correcciones y aprendizajes | Verificación |
| **Transcripts** | Conversaciones textuales del Owner | Exploración, diseño, implementación, cierre |

---

## Estructura de un Feature Completo

```
.tasks/mi-feature/
├── feature.md                    ← Contexto del feature
└── TASK-2026-001/
    ├── proposal.md               ← Propuesta aprobada
    ├── spec.md                   ← Especificación formal
    ├── design.md                 ← Diseño arquitectónico
    ├── tasks.md                  ← Tareas con test requirements
    ├── implementation-plan.md    ← Plan de ejecución
    ├── iterations/               ← Logs de implementación
    ├── verify-report.md          ← Resultado de verificación
    ├── functional-docs.md        ← Documentación funcional
    └── archive-report.md         ← Reporte de cierre
```

---

## Recursos

AOI instala un directorio `.resources/` gobernado para contexto reutilizable:

- `userstories/` — historias de usuario
- `workflows/` — definiciones de interacción entre componentes (no ejecutables)

Los recursos solo se usan si el Owner los vincula explícitamente durante la construcción de tareas.

---

## Dashboard

```bash
pnpm --dir aoi_apps/agentic-ops-dashboard dev
```

Panel de operaciones en tiempo real que muestra el estado de tareas, artefactos, y recursos del proyecto.

---

## Desinstalación

```bash
# macOS / Linux
bash "/path/to/AOI/teardown.sh" /path/to/my-project
```

```powershell
# Windows 11+
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\teardown.ps1" "C:\path\to\my-project"
```

> La desinstalación preserva `.tasks/` — el historial de tu proyecto nunca se borra.

---

**AOI v3.0** — Agentic Operational Infrastructure
