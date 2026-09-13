/**
 * scripts/spatiotemporal-runtime/effect-tracker-contract.test.mjs
 *
 * Las promesas del tracker de efectos, probadas contra lo que el módulo afirma.
 *
 * Va aparte de `spatiotemporal-runtime.test.mjs` por un corte real: ése prueba el
 * CICLO DE VIDA de las fibras —activación reactiva, descarga guardada— y éste las
 * PRIMITIVAS sobre las que ese ciclo se apoya. Cuando el archivo cruzó las 300 LOC
 * del Invariante 5, ésta era la mitad separable.
 *
 * Y es la mitad que más lo necesitaba: el encabezado de `effect-tracker.mjs`
 * afirmaba *"Every context mutation carries an explicit inverse"*, una universal que
 * una lente adversarial refutó por dos lados con código ejecutado. Las dos
 * refutaciones quedan acá como regresiones.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEffectContext } from './effect-tracker.mjs';


describe('"toda mutación tiene inversa" es una promesa que hay que sostener', () => {
  // El encabezado afirmaba *"Every context mutation carries an explicit inverse
  // disposer function that undoes the mutation"*, y una lente adversarial la
  // refutó por dos lados con código ejecutado. Las dos refutaciones están acá
  // como regresiones, porque son la misma familia que todo lo demás en este
  // repo: una afirmación que el sistema no sostiene.
  it('getState() devuelve una COPIA: mutarla no cambia el contexto', () => {
    // Antes devolvía el objeto vivo, así que `ctx.getState().a.b = 42` mutaba el
    // contexto SIN registrar inverso y `recover()` no lo deshacía. El módulo
    // prometía que no existían mutaciones sin inversa y entregaba la puerta.
    const ctx = createEffectContext({ a: { b: 0 } });

    ctx.getState().a.b = 42;

    assert.equal(ctx.getState().a.b, 0, 'una mutación por getState() llegó al contexto');
    assert.equal(ctx.activeEffectCount, 0);
  });

  it('el inverso de set() guarda una COPIA, no una referencia', () => {
    // Con la referencia, mutar el objeto previo DESPUÉS del `set` hacía que
    // `recover()` restaurara el valor mutado. Medido antes del arreglo:
    // volvía `{b:999}` en vez de `{b:0}` — el inverso existía y no servía.
    const initial = { a: { b: 0 } };
    const ctx = createEffectContext(initial);

    ctx.set('a', { b: 1 });
    initial.a.b = 999; // mutación in-place del objeto que era el "previo"

    ctx.recover();

    assert.deepEqual(ctx.getState().a, { b: 0 }, 'recover() restauró el objeto mutado, no el original');
  });

  it('CONTROL: lo que sí promete sigue funcionando', () => {
    const ctx = createEffectContext({ count: 0 });
    const undo = ctx.set('count', 10);
    assert.equal(ctx.getState().count, 10);
    assert.equal(ctx.activeEffectCount, 1);

    undo();
    assert.equal(ctx.getState().count, 0);
    assert.equal(ctx.activeEffectCount, 0);
  });

  it('CONTROL: LIFO sobre la misma clave, que es donde el orden importa', () => {
    const ctx = createEffectContext({});
    ctx.set('x', 1);
    ctx.set('x', 2);

    ctx.recover();

    assert.equal(Object.prototype.hasOwnProperty.call(ctx.getState(), 'x'), false, 'la clave tenía que quedar ausente');
  });
});
