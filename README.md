# AOI — Agentic Operational Infrastructure & AOI-OS

**Tu equipo de desarrollo de software autónomo, determinista y autosanable, orquestado por IA.**

AOI transforma cualquier repositorio en un espacio de trabajo agéntico con **memoria persistente (ICM)**, **agentes especializados**, un **ciclo de vida gobernado (SDD)** y **AOI-OS**: un sistema operativo determinista que ejecuta tareas complejas de forma autónoma con protección de contratos de código, sandboxes herméticos y auto-sanación.

---

## ⚡ ¿Cómo funciona?

```text
Tu proyecto
    ↓
setup.sh / setup.ps1    ← Instala infraestructura, agentes y AOI-OS
    ↓
/init                   ← Configura stack, convenciones e invariantes
    ↓
/sdd-new                ← Explora y propone el feature (@supervisor)
    ↓
/sdd-ff                 ← Diseña contratos y planifica tareas (@architect + @analyst)
    ↓
/sdd-apply (--os-mode)  ← Implementación autónoma vía AOI-OS o asistida por TDD
    ↓
/sdd-verify             ← Verificación de calidad, AST contracts y consensus score
    ↓
/sdd-archive            ← Documentación funcional y cierre formal en memoria
```

Cada paso cuenta con una **aprobación explícita del Owner/Arquitecto**. Tú diseñas la intención y los contratos sagrados; el sistema operativo agéntico ejecuta con garantías matemáticas de no-regresión.

---

## 🧠 AOI-OS: Sistema Operativo Agéntico Autónomo

AOI incluye en su núcleo **AOI-OS**, un runtime determinista compuesto por 8 subsistemas de alta precisión:

```text
AOI-OS Runtime Core
├── 1. Compilador DAG y Planificador de Olas (scripts/aoi-os/dag-engine/)
│   └── Compila tasks.md en grafos dirigidos acíclicos y calcula olas de ejecución paralela.
│
├── 2. Guardián AST Políglota (scripts/aoi-os/ast-guard/)
│   └── Protege interfaces y firmas públicas en C# (.cs), TypeScript, Vue SFC y Python.
│
├── 3. Motor de Consenso y Arbitraje Multi-Agente (scripts/aoi-os/consensus-gate/)
│   └── Evalúa seguridad OWASP (cero secretos, cero eval, sanitización) y límite de 300 LOC.
│
├── 4. Grafo Semántico de Memoria y Auto-Linker ICM (scripts/aoi-os/memory-linker/)
│   └── Extrae automáticamente decisiones, errores resueltos y enlaces relacionales (implements, depends_on).
│
├── 5. Runtime de Sandboxing Hermético Efímero (scripts/aoi-os/sandbox-runtime/)
│   └── Ejecuta código en .sandboxes/aoi-os-tmp-{taskId} con commits atómicos solo tras 100% verde.
│
├── 6. Gobernador Dinámico de Velocidad de Tokens (scripts/aoi-os/sandbox-runtime/)
│   └── Detección de anomalías en consumo (+40% de sobrecoste) y compresión adaptativa de contexto.
│
├── 7. Bucle de Auto-Sanación y Circuit Breaker (scripts/aoi-os/self-healing/)
│   └── Diagnóstico de fallos en tests, generación quirúrgica de fixes y rollback tras 2 reintentos.
│
└── 8. Telemetría SSE en Vivo y C2 Dashboard (server/api/aoi-os/ & Nuxt 4)
    └── Matriz DAG interactiva, controles de Playback (Pause/Resume/Step Wave) y Node Inspector Drawer.
```

---

## 👨‍💻 Tu Rol: De "Escribano de Código" a "Gobernador de Sistemas"

Con **AOI-OS**, tu paradigma de desarrollo evoluciona:

1. **Diseñador de Contratos e Invariantes**: En `/sdd-ff`, tú defines los esquemas, interfaces públicas y restricciones de seguridad.
2. **Comandante de Operaciones C2**: En el dashboard de Nuxt 4, supervisas la ejecución de olas del DAG, pausas o avanzas el sistema paso a paso e inspeccionas cualquier nodo.
3. **Juez de Escalación Estratégica**: El 95% de los errores de compilación o aserciones los resuelve la auto-sanación; tú solo intervienes ante ambigüedades arquitectónicas reales.

---

## 🛠️ Instalación y Configuración

### macOS / Linux
```bash
bash "/path/to/AOI/setup.sh" /path/to/my-project
```

### Windows 11+
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\setup.ps1" "C:\path\to\my-project"
```

### Prerrequisitos
- Node.js ≥ 20.19
- pnpm ≥ 11.3
- [ICM](https://github.com/rtk-ai/icm) (memoria persistente de contexto infinito)
- GitHub Copilot en VS Code o Antigravity IDE

---

## 🚀 Modos de Ejecución

### Modo Autónomo OS (Recomendado)
```bash
# Ejecutar directamente desde la terminal:
node scripts/aoi-os/aoi-os-cli.mjs --tasks .tasks/{feature}/{task-id}/tasks.md --workspace "$WORKSPACE" --auto-apply

# O desde Copilot Chat:
/sdd-apply --os-mode
```

### Modo Asistido Tradicional
```text
# En Copilot Chat:
/sdd-apply
```

---

## 📊 Panel de Operaciones (Dashboard C2)

Inicia el dashboard de observabilidad agéntica en tiempo real:

```bash
pnpm --dir aoi_apps/agentic-ops-dashboard dev
```

El dashboard incluye:
* **Matriz DAG de Ejecución**: Visualización SVG de dependencias entre tareas por olas.
* **Controles de Playback**: Pausar, Reanudar o Avanzar olas paso a paso.
* **Inspector de Nodos**: Desglose del prompt sintetizado, contratos AST, puntuación de seguridad y consumo de tokens.
* **Explorador de Recursos y Memoria**: Inspección gobernada de artefactos, relaciones y tópicos ICM.

---

## 🤖 El Equipo de Agentes Especializados

AOI opera bajo una topología **Hub-and-Spoke**: el Supervisor coordina, los especialistas ejecutan.

```text
                    ┌──────────────┐
                    │  @supervisor │  ← Coordina todo
                    └──────┬───────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
   ┌───────────────┐ ┌────────────┐ ┌──────────────┐
   │   Explorar    │ │ Implementar│ │   Verificar  │
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

---

## 🧪 Verificación de Calidad y Paridad

Para validar la integridad del sistema:

```bash
# Validar paridad byte por byte entre raíz y scaffold/:
pnpm test:parity

# Ejecutar todas las pruebas de AOI-OS:
pnpm test:aoi-os

# Ejecutar la suite global completa (134+ tests):
pnpm test
```

---

## 🗑️ Desinstalación Limpia

```bash
# macOS / Linux
bash "/path/to/AOI/teardown.sh" /path/to/my-project

# Windows 11+
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AOI\teardown.ps1" "C:\path\to\my-project"
```
> La desinstalación preserva `.tasks/` y la memoria ICM — el historial y conocimiento de tu proyecto nunca se pierden.

---

**AOI v3.5 & AOI-OS** — Autonomous, Deterministic & Self-Healing Agentic Operational Infrastructure
