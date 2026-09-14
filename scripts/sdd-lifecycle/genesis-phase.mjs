/**
 * scripts/sdd-lifecycle/genesis-phase.mjs
 *
 * La Fase -2 (`/sdd-genesis`) como unidad medible, autocontenida.
 *
 * Existe por una restricción aritmética, no por gusto: `sdd-stress-suite.mjs`
 * estaba en 299 LOC antes de agregar esta fase, con el Invariante 5 cortando en
 * 300. Una fase nueva inline no entra — y ensanchar el límite para que entre
 * sería exactamente el movimiento que el límite existe para impedir.
 *
 * Se re-exporta desde `blueprint-gate.mjs`, siguiendo el precedente de
 * `invariant-gate.mjs` con `test-reachability.mjs`: el corte es interno y ningún
 * llamador debería tener que saber dónde cayó.
 *
 * El corpus es un FIXTURE y se declara como tal. Un SBC real vive en el
 * WORKSPACE, no en el repositorio del instrumento. Reproduce la forma de un
 * blueprint cerrado —tres contextos, tres invariantes, dos cruces con flujo
 * nombrado— porque es la única entrada con la que la compuerta puede aprobar, y
 * medir el costo de una compuerta que habría bloqueado no mide nada.
 */

import { estimateTokens, FIXTURE, SKIPPED } from './token-accounting.mjs'
import { auditBlueprintClosure, formatBlueprintGateReport } from './blueprint-gate.mjs'

/** El blueprint en prosa: lo que un revisor tendría que leer para juzgar clausura. */
export const BLUEPRINT_PROSE = [
  '# System Blueprint Contract — SBC-2026-001',
  '',
  '## D1. Motor de Valor & Capacidades Core',
  'Plataforma de cobros para creadores independientes. El problema crítico es que',
  'hoy concilian a mano entre tres pasarelas y pierden el rastro de qué cobro',
  'corresponde a qué venta. Directrices no funcionales que mandan sobre el diseño:',
  'idempotencia estricta en toda operación de cobro, latencia p99 menor a 800 ms en',
  'la ruta de autorización, y consistencia fuerte entre el asiento contable y el',
  'estado del cobro. Vectores de fallo catastrófico: cobrar dos veces por el mismo',
  'pedido, y perder un asiento ya confirmado.',
  '',
  '## D2. Topología de Dominios y Bounded Contexts (HIPÓTESIS)',
  'Se parte en tres contextos. `gateway` recibe la intención de cobro y normaliza',
  'las diferencias entre pasarelas. `billing` aplica las reglas de negocio del',
  'cobro: comisiones, retenciones, reintentos. `ledger` es el libro append-only y',
  'es el único que tiene autoridad sobre el saldo. Se elige monolito modular y no',
  'servicios porque el volumen inicial es de dos órdenes de magnitud menor que el',
  'punto donde la separación de despliegue paga su costo operativo. Persistencia',
  'relacional para billing —las reglas son transaccionales y necesitan locking—, y',
  'append-only para ledger, donde la corrección es no perder el orden de los hechos.',
  '',
  '## D3. Invariantes Constitucionales Globales',
  '- NUNCA registrar PII en logs.',
  '- NUNCA aplicar un asiento sin su referencia de cobro.',
  '- NUNCA reintentar un cobro ya confirmado.',
  '',
  '## D4. Grafo de BICs y Tracer Bullet',
  'Tracer Bullet: cobrar una orden de punta a punta —gateway -> billing -> ledger—',
  'y verificar el asiento. Es la rebanada más delgada que atraviesa las tres capas',
  'y la única forma de saber si la partición de contextos se sostiene.',
].join('\n')

/** El mismo blueprint en la forma estructurada que consume la compuerta. */
export const BLUEPRINT_FIXTURE = {
  sbcId: 'SBC-2026-001',
  contexts: ['gateway', 'billing', 'ledger'],
  globals: [
    { tag: 'SBC-2026-001:never.1', statement: 'NUNCA registrar PII en logs' },
    { tag: 'SBC-2026-001:never.2', statement: 'NUNCA aplicar un asiento sin su referencia de cobro' },
    { tag: 'SBC-2026-001:never.3', statement: 'NUNCA reintentar un cobro ya confirmado' },
  ],
  crossings: [
    { tag: 'SBC-2026-001:crossing.1', parsed: { from: 'gateway', to: 'billing', flow: 'charge-request' } },
    { tag: 'SBC-2026-001:crossing.2', parsed: { from: 'billing', to: 'ledger', flow: 'post-entry' } },
  ],
  tracer: 'gateway -> billing -> ledger',
}

/**
 * Los hechos O(1) que la compuerta realmente lee, tal como los devolvería
 * `icm facts list`. Esto —y no la prosa— es lo que cuesta correr la compuerta.
 */
export function blueprintFactsText(blueprint = BLUEPRINT_FIXTURE) {
  return [
    `${blueprint.sbcId}.contexts  ${blueprint.contexts.join(', ')}`,
    ...blueprint.globals.map((g) => `${g.tag}  ${g.statement}`),
    ...blueprint.crossings.map(
      (c) => `${c.tag}  ${c.parsed.from} -> ${c.parsed.to}: ${c.parsed.flow}`,
    ),
    `${blueprint.sbcId}.tracer  ${blueprint.tracer}`,
  ].join('\n')
}

/**
 * Mide y reporta la fase completa: header, aserción, fila del ledger y salida.
 *
 * Devuelve `{ row, audit, ok }` en vez de fijar el código de salida, porque
 * quién decide si un fallo aborta la corrida es el suite, no este módulo.
 *
 * `blueprint` es inyectable para que los tests puedan ejercitar el camino de
 * fallo sin editar el fixture — un test que sólo prueba el camino feliz dejaría
 * pasar exactamente la regresión que importa: un fixture que se rompe y una fase
 * que reporta un ahorro de una compuerta que habría bloqueado la aprobación.
 *
 * @param {ReturnType<import('./token-accounting.mjs').createLedger>} ledger
 * @param {typeof BLUEPRINT_FIXTURE} [blueprint]
 */
export function runGenesisPhase(ledger, blueprint = BLUEPRINT_FIXTURE) {
  console.log('▶ [Fase -2: /sdd-genesis] Testing mechanical blueprint closure...')

  const audit = auditBlueprintClosure(blueprint)
  const ok = audit.status === 'PASSED'

  // Un fixture roto no se registra como mesurado: la compuerta habría BLOQUEADO
  // la aprobación, así que no hay ahorro que reportar. Se registra SKIPPED, que
  // el ledger cuenta en la fidelidad pero no suma a los totales — así la fase
  // sigue apareciendo en la contabilidad sin inflar el ahorro con algo que no
  // ocurrió.
  const row = ledger.record('Phase_-2_Genesis', '/sdd-genesis (Blueprint Closure)', {
    raw: ok ? estimateTokens(BLUEPRINT_PROSE) : 0,
    opt: ok ? estimateTokens(blueprintFactsText(blueprint)) : 0,
    provenance: ok ? FIXTURE : SKIPPED,
    source: ok ? 'fixture (el SBC vive en el WORKSPACE, no en el repo)' : '',
    details: ok
      ? 'Clausura mecánica de 5 aserciones sobre hechos O(1) vs lectura del blueprint en prosa'
      : 'el fixture del SBC no está cerrado: la compuerta habría bloqueado la aprobación',
  })

  if (!ok) {
    console.error('  ✖ el fixture del SBC no está cerrado; la fase mediría un blueprint inválido')
    console.error(formatBlueprintGateReport([audit]))
    return { row, audit, ok }
  }

  console.log(
    `  ✓ Phase -2 complete: ${row.rawTokens} tokens -> ${row.optimizedTokens} tokens (${row.percentSaved} saved) [fixture]\n`
  )
  return { row, audit, ok }
}
