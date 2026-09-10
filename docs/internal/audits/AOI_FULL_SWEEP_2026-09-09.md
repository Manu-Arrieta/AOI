# Auditoría exhaustiva de AOI — ciclo 2026-09-09

Rama `audit/aoi-full-sweep`. Superficie auditada: **177 artefactos gobernados** —
49 scripts, 46 suites de test, 30 prompts, 27 agentes, 6 skills, 6 instructions,
5 hooks, 8 scripts de shell.


> [!IMPORTANT]
> **ESTADO AL 2026-09-10: los ocho GAPs de este informe están CERRADOS, y las
> cinco oportunidades de ahorro implementadas o cuantificadas.** El documento se
> conserva como está — describiendo cada hallazgo tal como se encontró — porque
> el valor de una auditoría no es la lista de arreglos sino el registro de qué
> pudo vivir meses sin que nada fallara, y por qué.
>
> El cierre, con lo que se midió y lo que se decidió, está en
> [`AOI_FULL_SWEEP_CLOSEOUT.md`](AOI_FULL_SWEEP_CLOSEOUT.md).

## Método

La auditoría **no parte del diff**. Auditar un diff solo encuentra lo que alguien ya
tocó, y este repositorio tiene documentado que sus peores huecos vivieron meses en
código que nadie estaba mirando. Parte de lo que AOI **afirma**: cada invariante, cada
mecanismo de ahorro y cada compuerta se trata como una afirmación a refutar.

Tres instrumentos, todos deterministas y de 0 tokens de inferencia:

1. **Inyección de violaciones reales.** A cada compuerta se le construye la violación
   exacta que dice detectar y se mide su exit code.
2. **Testing de mutación.** Se muta el código en una copia aislada y se corre la suite:
   un mutante que sobrevive es una línea que ningún test restringe. AOI no lo tenía.
3. **Declarado vs cableado.** Para cada mecanismo, se busca quién lo invoca en el ciclo
   real — no en el benchmark, no en la prosa.

Todo se ejecuta en copias en `scratchpad` o en `AOI TESTS`. **Nunca en el repo de
desarrollo**, y esa regla hay que escribírsela explícitamente a cada agente delegado:
en la auditoría adversaria previa al merge, un agente inyectó su fallo directamente en
el árbol de trabajo y lo dejó ahí.

---

## GAPs por severidad

### ⛔ G0 — El instalador borra archivos del usuario fuera del merge, sin respaldo ni reporte

`prune_unselected_harness_files()` (`setup.sh:62-91`) hace `rm -f` / `rm -rf`
**incondicional** sobre `CLAUDE.md`, `AGENTS.md`, `.agents/`, `.cursorrules`, `.cursor/`,
`.clinerules` y `.github/copilot-instructions.md`. Sin checksum, sin comparar contra el
scaffold, sin entrada en `.conf/conflicts/`, sin respaldo.

Es **la misma patología del incidente de `aoi_apps`** que este proyecto ya arregló una
vez: una ruta destructiva que puentea el merge de tres vías. La regla que hace seguro a
ese merge es que *el comparador recorre el scaffold, no el proyecto*, de modo que un
archivo que el usuario creó nunca se visita. Esta función la viola entera.

**Verificado**, extrayendo la función real de `setup.sh` y ejecutándola sobre un árbol de
prueba:

| Archivo | Resultado |
| :--- | :--- |
| `CLAUDE.md` con reglas propias del Owner | ❌ BORRADO |
| `AGENTS.md` editado por el Owner | ❌ BORRADO |
| `.agents/skills/mia/SKILL.md` — **skill que el usuario creó y que AOI nunca entregó** | ❌ BORRADO |
| Respaldo o reporte de conflicto | ninguno |

`rm -rf .agents` arrasa un árbol entero, incluidos archivos sobre los que AOI no tiene
ningún derecho.

**Cuándo dispara.** `SELECTED_HARNESS` es `all` por defecto y con `all` la función sale
temprano, así que la instalación no interactiva es segura. Dispara cuando el usuario
elige un harness puntual — con `--harness <x>` o con el **menú interactivo**, que es la
vía principal de instalación (`setup.sh:376-393`).

En primera instalación es inocuo: esos archivos los acaba de crear AOI. **El daño es en
el reinstall**, y lo habilita un segundo hallazgo: **la elección de harness no se
persiste**. `.conf/manifest.json` guarda versiones, herramientas y fecha, pero no el
harness, así que en cada reinstall el Owner vuelve a elegir sin que AOI recuerde qué
eligió antes.

> Escenario completo: instalás con `all`, personalizás `CLAUDE.md`, creás tus propios
> skills en `.agents/`. Meses después reinstalás y elegís "Copilot" en el menú. Todo eso
> desaparece — mientras el instalador imprime `files_kept: 333, conflicts: 0`.

Remediaciones posibles, en orden de esfuerzo: pasar estos archivos por el mismo merge de
tres vías; o comparar contra el scaffold antes de borrar y conservar lo modificado
reportándolo como `kept:`; o como mínimo persistir el harness en `.conf/` y exigir
confirmación explícita cuando el reinstall cambia la selección.

### 🔴 G1 — El Invariante 1 no está implementado

> *"Zero-Disabled-Tools: las 7 suites MCP permanecen activas; **el ahorro de tokens se
> logra mediante el proxy `mcp-compressor`**."*

El proxy no existe en el producto.

| Comprobación | Resultado |
| :--- | :--- |
| `@atlassian-labs/mcp-compressor` en `package.json` / lockfile | ❌ no es dependencia |
| `setup.sh` lo instala o lo registra | ❌ no lo menciona nunca |
| Registrado en el `.vscode/mcp.json` de una instalación real | ❌ solo `icm` y `codebase-memory-mcp` |
| `setup-mcp-gateway.mjs` lo configura | ❌ valida la forma de un JSON y sale |

`generateCompactSignature()` devuelve **strings hardcodeados en un `switch`**, sin
ninguna conexión con el esquema real de una herramienta. El script se llama `setup-` y
no configura nada.

Lo agrava el protocolo: el Paso 0.2 lista *"Auditar firmas del Gateway MCP Compressor"*
como validación del entorno. Ese paso corre `--signatures`, imprime los strings
hardcodeados y sale 0. **Ha estado certificando la existencia de un componente que no
existe.** El diagrama de arquitectura lo dibuja como pieza viva del flujo.

### 🔴 G2 — Una superficie ×6 le afirma al agente algo falso

`.github/skills/rtk/SKILL.md:39` se carga en las seis fases y cuesta **2.526 tokens por
ciclo**:

> *"The `PreToolUse` hook (`rtk-rewrite.json`) **automatically enforces** RTK prefixing."*

En una instalación real, nada carga ese hook. No hay `.claude/settings.json`;
`.vscode/settings.json` no menciona hooks; los únicos archivos que referencian
`.github/hooks/` son los propios hooks y prosa.

Es la peor combinación: RTK es la regla que AOI declara **MANDATORY** para ahorrar
60-90%, y se paga seis veces por ciclo para decirle al agente que se aplica sola.

### 🔴 G3 — El rollback del Invariante 3 está duplicado, y la mitad que le da nombre no se testea

`subagent-fiber-runner.mjs` contiene **dos implementaciones byte-idénticas**:

| Líneas | Qué es | Test |
| :--- | :--- | :--- |
| 55-70 | el closure de teardown del **Fiber** | ❌ ninguno lo invoca |
| 99-105 | el método `rollback()` manual | ✅ `sandbox.rollback()` |

El invariante se llama *"Fiber Sandboxes Reversibles"* y la ruta integrada al Fiber —
la que le da el nombre — no la ejercita nadie. Demostración: con `===` mutado a `!==`
en la L60, un archivo preexistente con contenido del Owner queda **BORRADO** tras el
rollback en vez de restaurado, y la suite sigue verde.

Además son dos copias del mismo bloque en el mismo archivo. Van a divergir.

### 🟠 G4 — Dos superficies siempre inyectadas se contradicen

| Archivo | Dice para "decisión de arquitectura" |
| :--- | :--- |
| `CLAUDE.md:18` (generado) | `-i high` |
| `.github/instructions/icm-protocol.instructions.md:130` | `critical` |

Las dos están siempre en contexto. Causa raíz: el docstring de `compile-rules.mjs`
declara compilar *"from `.github/instructions/`"* y el módulo **nunca abre ese
directorio** — las plantillas están hardcodeadas. Editar la fuente canónica y correr
`pnpm aoi:sync-rules` imprime *"Compiled N files successfully"* y no propaga nada.

### 🟠 G5 — Cinco hooks declarados que ningún harness carga

`icm.json`, `post-tool-learning.json`, `rtk-rewrite.json`, `session-close.json`,
`session-init.json`. Los cinco `.sh` que invocan existen y están espejados; `setup.sh`
los hace ejecutables pero nunca los conecta a la configuración de un harness.

### 🟠 G6 — Ninguna compuerta tiene test de su exit code

`pnpm test` es una cadena de `&&` de siete CLIs. **Cero** tienen un test que asegure que
salen ≠ 0 ante una violación.

Verificado empíricamente por primera vez, y la noticia es buena: **las 7 detectan**.

| Compuerta | Violación inyectada | Exit |
| :--- | :--- | ---: |
| `cache-guard` | timestamp ISO en el prefijo | 1 ✅ |
| `cache-prefix` | buster en la banda ×6 | 1 ✅ |
| `handoffs` | el productor renombra `design.md` | 1 ✅ |
| `lint-refs` | referencia a un script inexistente | 1 ✅ |
| `routing` | agente fuera del registro | 1 ✅ |
| `srp` | archivo de 400 LOC | 1 ✅ |
| `test-globs` | directorio de tests vaciado | 1 ✅ |

Funcionan hoy. Nada protege que sigan funcionando.

### 🟠 G7 — Mutation score 49%

160 mutaciones en copia aislada, 81 sobrevivieron.

| Score | Área |
| ---: | :--- |
| 20% | `multi-harness` |
| 35% | `spatiotemporal-runtime` ← Invariante 3 |
| 50% | `memory-sync` |
| 53% | `subagent-context` ← Invariantes 2 y 6 |
| 54% | `sdd-lifecycle` |
| 70% | `scaffold` |

Triado: 20 sobrevivientes son plomería de CLI, 61 son lógica. Buena parte de los 61 son
guardas de validación de entrada que ningún test golpea con la entrada inválida — reales
pero de baja severidad. **Los peores puntajes caen justo sobre los invariantes que AOI
más publicita.**

---

## Oportunidades de ahorro

### 💰 A1 — Tombstoning: 1.085 tokens por ciclo tirados

`context-tombstone.mjs` funciona, está testeado, y el benchmark le acredita ahorro. Pero
**ningún prompt ni agente lo invoca**: es el único mecanismo cuya única referencia viva
está en el benchmark.

Desglose medido de la Fase 3:

| Mecanismo | Base | Optimizado | Ahorro |
| :--- | ---: | ---: | ---: |
| AST-Lens | 4.161 | 964 | 3.197 |
| Scaffolding | 103 | 0 | 103 |
| **Tombstoning** | **1.166** | **81** | **1.085** |

Son el **24,7% de la Fase 3 y el 6,9% del ahorro total del ciclo**. Hoy el benchmark los
cuenta y el ciclo real no los consigue. Cablearlo en `/sdd-apply` convierte una cifra
inflada en ahorro verdadero.

### 💰 A2 — La banda ×6 es donde vale recortar

Del ciclo anterior, ya en main: un token recortado en los 8 archivos que se cargan en las
seis fases vale seis; en un prompt de fase vale uno. `pnpm aoi:cache-prefix` publica el
orden real. El archivo más grande del ciclo (`speckit.specify.agent.md`, 4.101) es apenas
el sexto en costo real.

### 💰 A3 — Boilerplate idéntico en los 27 agentes: ~630 tokens por ciclo

404 frases aparecen en 5 o más de los 27 agentes. El bloque `## Model Requirement`
aparece en **los 27**, y de sus ~67 tokens hay **42 byte-idénticos en todos**:

```
## Model Requirement
> ⚠️ Selecciónalo en el picker de Copilot antes de invocar al agente.
> Registro completo: `.github/instructions/agent-delegation.instructions.md`
```

Contando solo los 10 agentes que el piso realmente carga, el bloque completo cuesta
**988 tokens por ciclo** (el supervisor lo paga ×6). La parte genérica —el aviso del
picker y el puntero al registro— son **630 de esos 988**.

Lo que la vuelve recortable: el puntero apunta a `agent-delegation.instructions.md`, que
**ya se inyecta en las seis fases**. Se está gastando en decir 27 veces "mirá aquel
archivo" mientras aquel archivo está en el contexto.

Lo que debe quedar por agente: el nombre del modelo y su fallback, que sí son
específicos y sí son carga útil.

*No implementado.* Exige prueba de equivalencia: una sonda conductual que confirme que un
agente sigue eligiendo su modelo con el aviso enunciado una sola vez en el registro.

### 💰 A4 — Derivar la copia de antigravity: hasta 2.526 por ciclo, y de paso arregla G4

`skills/rtk/SKILL.md` (421) e `instructions/rtk.instructions.md` (334) comparten el 29,4%
del fraseo y el orquestador recibe los dos: 4.530 por ciclo. En el ciclo anterior el
corte se **descartó** porque antigravity no lee `.github/instructions/` y perdería la
regla.

Ese rechazo asumía que la copia de antigravity tiene que mantenerse a mano. No tiene por
qué: `compile-rules.mjs` ya escribe `.agents/`, así que podría **generar** la copia de
antigravity a partir del archivo canónico de instructions en vez de espejar un skill
escrito aparte. Una sola fuente, dos superficies derivadas, sin hueco de comportamiento.

El mismo cambio arregla **G4**: hoy `compile-rules.mjs` declara compilar desde
`.github/instructions/` y nunca lo abre, que es exactamente por qué `CLAUDE.md` y
`icm-protocol` se contradicen. Hacer verdadera esa declaración elimina la contradicción y
habilita el ahorro con el mismo trabajo.

### 💰 A5 — El Invariante 1, si se implementara

La afirmación es 85% de reducción del overhead de esquemas MCP. Hoy es 0% porque el
proxy no existe. **No está cuantificado en este informe**: medirlo exige instrumentar
lo que el harness inyecta por esquemas MCP, que es trabajo aparte. Se deja anotado
porque la afirmación sigue publicada.

---

## Lo que resultó sólido

- **Las 7 compuertas ligan** (G6), verificado con violaciones reales.
- **El piso de contexto reconcilia al token** entre tres instrumentos independientes:
  presupuesto, ensamblador y economía de cache. 90.894.
- **El reinstall inteligente respeta el trabajo del usuario.** Productor y consumidor
  coincidieron (2 updated / 3 new / 0 conflictos / 0 huérfanos) y los 79 archivos de
  usuario quedaron byte-idénticos, canario incluido.
- **Cero contenido volátil** en la banda que se recarga, verificado sobre archivo
  completo.
- **Ninguna fase reescribe una superficie siempre inyectada.**

---

## Ahorro total identificado

| Idea | Tokens/ciclo | Estado |
| :--- | ---: | :--- |
| A1 · cablear `context-tombstone` en `/sdd-apply` | **1.085** | mecanismo listo y testeado, solo falta invocarlo |
| A4 · derivar la copia de antigravity desde instructions | hasta **2.526** | arregla G4 con el mismo trabajo |
| A3 · boilerplate genérico fuera de los 27 agentes | **630** | exige sonda de equivalencia |
| **Total** | **~4.241** | |
| A5 · Invariante 1 | sin cuantificar | el proxy no existe |

Para dimensionarlo: **v2.3.0 completa recortó 4.002 tokens por ciclo**. Lo identificado
acá la iguala, y A1 es plata en la mesa — un mecanismo que ya funciona y que nadie
dispara.

Ninguna está implementada. Las tres exigen prueba de equivalencia antes de tocarse, que
es la regla de este proyecto: el ahorro nunca justifica una pérdida de capacidad no
verificada.

## Pendiente

- Ciclo SDD real punta a punta con agentes produciendo artefactos.
- Entradas adversarias.
- `setup.sh` (1.300+ líneas) más allá del protocolo de reinstall.
- Dashboard `aoi_apps` más allá de sus 35 tests.
- Cuantificar A3.
