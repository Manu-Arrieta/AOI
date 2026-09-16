# Tarea 8 — Reducción medida de prompts y contexto

**Corte:** 2026-09-16. **Alcance:** la superficie fija de `.github/` que
`assemblePhaseContext()` materializa en las siete fases SDD.

## Medición

`payloadFloor` tokeniza el texto literal ensamblado, incluido el framing. Es
una medida estática del corpus local, no una factura de proveedor ni una promesa
para un harness que cargue otro contexto.

| Medida | Antes | Después | Delta |
| --- | ---: | ---: | ---: |
| Payload literal por ciclo | 106.953 | 105.424 | **−1.529** |
| Contenido atribuible a fuentes | 105.869 | 104.340 | **−1.529** |
| Framing del ensamblador | 1.084 | 1.084 | 0 |

El ahorro observado es 1,43 % del payload literal fijo. No incluye payload
variable, caché, proveedor ni comportamiento de otro harness.

## Cambios seguros

| Cambio | Conserva | Delta observado |
| --- | --- | ---: |
| `supervisor.agent.md` deja de copiar activación MCP y detección de workspace | El protocolo ICM universal sigue siendo dueño de ambas; Supervisor conserva recalls específicos, ruteo, Hub-and-Spoke y compuertas. | −1.211/ciclo |
| `sdd-genesis.prompt.md` compacta el bloque Flash | Modelo Flash, fallback Pro y límite de no afirmar mejor razonamiento. | −220/ciclo |
| `model-selection.instructions.md` compacta tooling | Primary/Fallback, registro, rutas de configuración y referencia a RTK. | −98/ciclo |

Se retiraron comparativas históricas, fases históricas y un identificador
`customendpoint` de subagente que `/sdd-genesis` no invoca. También se retiró
el porcentaje universal no evidenciado de reducción de tokens.

## Controles y verificación

- `supervisor-icm-dedup.test.mjs` falla si la doctrina vuelve a duplicarse o si
  el protocolo ICM pierde una de sus dos operaciones canónicas.
- `genesis-model-contract.test.mjs` falla ante modelo/fallback ausente,
  sobreafirmación de razonamiento o transporte de subagente ajeno a Genesis.
- `agent-model-blocks.test.mjs` falla ante una regla Fallback ausente o la
  reintroducción de `60–90% token reduction`.
- Pasaron `pnpm test`, `pnpm test:parity`, `pnpm aoi:doctor` (13/0/0),
  `aoi:claims`, `aoi:lint-refs`, `aoi:audit-protocol`, `aoi:tools`,
  `aoi:routing`, `aoi:importance`, `aoi:context` y `aoi:cache-prefix`.

## Límite explícito

No se excluyó `agent-delegation.instructions.md` de `/sdd-frame`: aunque su
camino principal no delega, dos ramas condicionales enrutan a
`@triage-specialist`. Un `applyTo` estático que lo retirara quitaría el
contrato de esa rama para mejorar artificialmente el piso.

Los bloques universales restantes contienen contratos que el ciclo aún
consume. Un ahorro sustancial adicional requiere rediseñar la inyección del
harness por rama real, con BIC, compatibilidad multi-harness y validación
conductual propios. No se implementa ni se contabiliza como recorte textual.

Los diagramas Archify existentes no cambian: no se modificó ningún componente
ni arista arquitectónica, sólo el tamaño y la propiedad del contexto cargado.
