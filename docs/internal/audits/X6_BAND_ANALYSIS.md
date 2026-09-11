# La banda ×6: qué se pudo recortar y qué no

**Rama:** `perf/x6-band` · **2026-09-11**

La banda ×6 es el conjunto de archivos que las seis fases del ciclo SDD cargan,
así que un token recortado ahí vale seis. Al abrir la rama medía **56.436
tokens por ciclo** en ocho archivos, sobre un piso de 90.059.

Este documento existe para que la próxima pasada no repita el análisis ni las
hipótesis que se cayeron.

## Resultado

| | |
| :--- | ---: |
| PISO al abrir | 90.059 |
| PISO al cerrar | 86.873 |
| **Recortado** | **−3.186 por ciclo** |

Para dimensionarlo: el ahorro total que el benchmark mide por ciclo es 16.452,
así que esto es un **19% adicional**, de dos ediciones.

## Lo que se recortó

### 1. `supervisor.agent.md` — la tabla «Agent Roster» · −1.098

Era la tabla «SDD Lifecycle — Phase Routing» transpuesta, tres secciones más
arriba del mismo archivo: los mismos ocho agentes, la columna `Role` restando
lo que la columna `Phase` ya decía, y una columna `Copilot` que es el nombre
con una arroba adelante.

Aportaba **exactamente dos cosas** que no estaban en ningún otro lugar de la
banda, y las dos se movieron a la tabla de ruteo donde describen una fase en
vez de ser un segundo listado del elenco: el propósito de `@project-expert`
—`agent-delegation` lo nombra, pero sólo para asignarle modelo— y que
`backend-developer` y `devops-engineer` son opcionales.

### 2. `.github/skills/icm/SKILL.md` — delega en su instruction · −2.088

De nueve conceptos que enseñaba, ocho ya estaban en
`icm-protocol.instructions.md`, que tiene `applyTo: "**"`. El único que no: el
umbral de «20+ llamadas a herramientas sin un store».

No se podía borrar sin más porque **antigravity no lee
`.github/instructions/`**: para ese harness la skill era la única doctrina ICM.
La salida ya estaba construida y registrada para un solo nombre —
`deriveSkillFromInstruction` arma la copia de `.agents/` A PARTIR de la
instruction. Agregarle `icm` es una línea, y antigravity pasó de 776 tokens
espejados a 2.123 derivados: recibe **más**, no menos.

## Las tres hipótesis que se cayeron

Se documentan porque las tres son plausibles y alguien las va a volver a tener.

### «`Session Start` se ejecuta una vez por sesión y se paga seis veces»

**Falsa.** Las seis fases dicen `You are the @supervisor`, que es una
**asignación de identidad**, no una delegación. El agente no puede saber si es
la primera invocación, así que genuinamente necesita el bloque cada vez.
`supervisor.agent.md` no se puede sacar de ninguna fase.

### «El bloque `activate_*` está tres veces en la banda; deduplicar da 834»

**El hecho es cierto, el corte no es legítimo.** La copia canónica vive en
`icm-protocol.instructions.md` con `applyTo: "**"`, y que las otras sean
redundantes depende de si Copilot inyecta las instructions dentro de una
invocación de agente — **comportamiento del harness, no contenido del repo**.
No se puede probar desde el repositorio, así que no se corta.

### «La tabla de compuertas de `sdd-lifecycle/SKILL.md` duplica la del supervisor»

**Se solapan, pero el corte deja ciego a un harness.** El supervisor tiene la
cadena de compuertas del Owner; la skill tiene la taxonomía completa, incluidas
TDD, UX e Invariant, que no son del Owner. Y antigravity **no ve
`.github/agents/`**, así que la skill es su única fuente de compuertas —
`aoi-rules.md` no las lleva. Habría hecho falta crear una instruction de
compuertas, que al tener `applyTo: "**"` entraría a la banda ×6 y anularía el
ahorro.

## Por qué los otros cinco resisten

| Archivo | Por qué no se toca |
| :--- | :--- |
| `icm-protocol.instructions.md` | Es la fuente canónica de la que ahora derivan dos skills. Recortarla rompe las derivaciones. |
| `agent-delegation.instructions.md` | El Agent Registry tiene uso en runtime: el supervisor necesita el modelo ANTES de invocar. Estrechar su `applyTo` a las fases que delegan firmemente es inseguro, porque las Fases 0, 1 y 3 delegan de forma **condicional** y un glob sobre rutas no puede expresar «sólo si la condición dispara». |
| `sdd-lifecycle/SKILL.md` | Ver la tercera hipótesis. Su tabla «ICM Topics Per Phase» tampoco duplica la §8 de la instruction: la skill dice qué **topic** usar por fase, la instruction qué **verbo** invocar por evento. |
| `model-selection.instructions.md` | Ya deduplicado en una pasada anterior: su §3 es un puntero a `agent-delegation`, no una copia. |
| `rtk.instructions.md` y `rtk/SKILL.md` | Ya optimizados con el mismo patrón de derivación, en la pasada que lo construyó. |

## La compuerta que faltaba

Nadie probaba `deriveSkillFromInstruction`, ni siquiera para el corte de RTK
que ya estaba en `main`. Una skill podía encogerse sin registrarse para
derivación y antigravity perdía el contenido en silencio, con todos los gates
en verde. `scripts/multi-harness/skill-derivation.test.mjs` fija ahora la
pareja recorte↔derivación y que la copia derivada sea **más grande** que la
recortada.

Su primera versión adivinaba la delegación desde la prosa y marcó
`spec-kit-integration`, que sólo **cita** una instruction para una referencia
cruzada. Es el mismo error que `phase-references` ya había cometido con la
condicionalidad, y la solución es la que el repo ya había elegido: un marcador
declarado, `<!-- canonical-instruction: … -->`, nunca inferencia.

## Método, para la próxima

1. Medir la banda con `pnpm aoi:cache-prefix` **antes** de tocar nada, y anotar
   piso y huella de masa repetida.
2. Para cada candidato, preguntar **qué aporta que no esté en otra superficie
   de la banda** — ítem por ítem, no de un vistazo.
3. Antes de cortar, preguntar **qué harness se queda sin eso**. Copilot lee
   `.github/instructions/`; antigravity sólo `.agents/`; el resto lee su
   archivo compilado. Un corte que Copilot no nota puede dejar ciego a otro.
4. Si un gate falla, leer **por qué existe** antes de tocarlo. Dos veces acá el
   comentario de un test explicó un riesgo que el corte habría materializado.
5. Medir después, y exigir que la **huella cambie** — si no cambió, no se tocó
   una superficie siempre inyectada y el ahorro está en otro lado.
